from django.shortcuts import render, get_object_or_404
import requests
from django.shortcuts import redirect, render
from django.contrib import messages 
from .forms import *
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.csrf import csrf_protect

# Create your views here.

def home(request):
    if not request.session.get('access'):
        return redirect('login')
    access_token = request.session.get('access')
    profile_id = request.session.get('profile_id')

    if not profile_id:
        messages.error(request, "Profile ID not found.")
        return redirect('login')
    access_token = request.session.get('access')
    headers = {'Authorization': f'Bearer {access_token}'}
    response = requests.get('http://127.0.0.1:8001/media/all-posts/', headers=headers)

    posts = []
    if response.status_code == 200:
        posts = response.json().get('data', [])
        for post in posts:
            # Fix media file URLs
            post['media'] = [
                f"http://127.0.0.1:8001{m['file']}" for m in post.get('media', [])
            ]
            # Fix profile picture URL
            if post.get('profile_picture'):
                post['profile_picture'] = f"http://127.0.0.1:8001/media/{post['profile_picture']}"
            else:
                post['profile_picture'] = '/static/images/profile_picture.png'
    profile_data = {}
    try:
        profile_url = f'http://127.0.0.1:8001/profile/profile/{profile_id}/'
        profile_response = requests.get(profile_url, headers=headers)
        if profile_response.status_code == 200:
            profile_data = profile_response.json().get('data', {})
        else:
            messages.error(request, "Failed to fetch profile data.")
    except Exception as e:
        print("Profile fetch error:", str(e))
        messages.error(request, "Error occurred while fetching profile.")

    return render(request, 'Facebook-Clone-main/index.html', {'posts': posts, 'profile': profile_data})



def login_page_view(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            try:
                email = form.cleaned_data['email']
                password = form.cleaned_data['password']

                # API call to login endpoint
                url = "http://127.0.0.1:8001/user/login/"
                payload = {'email': email, 'password': password}
                response = requests.post(url, data=payload)
                result = response.json()

                if response.status_code == 200 and result.get('status') is True:
                    data = result['data']
                    # Store data in session
                    request.session['access'] = data.get('access')
                    request.session['refresh'] = data.get('refresh')
                    request.session['profile_id'] = data.get('profile_id')
                    request.session['username'] = data.get('username')
                    request.session['email'] = data.get('email')
                    request.session['profile_type'] = data.get('profile_type')
                    request.session['user_type'] = data.get('user_type')

                    return redirect('dashboard')

                else:
                    messages.error(request, result.get('message', 'Invalid credentials'))

            except Exception as e:
                print(str(e))
                messages.error(request, 'Something went wrong during login.')
    else:
        form = LoginForm()

    return render(request, 'login/login.html', {'form': form})

def logout_view(request):
    try:
        request.session.flush()
        messages.success(request, "You have been logged out successfully.")
        return redirect('login')
    except Exception as e:
        print(str(e))
        messages.error(request, "Something went wrong during logout.")

    return redirect('login')



import requests
from django.shortcuts import render, redirect
from django.contrib import messages

def dashboard_view(request):
    if not request.session.get('access'):
        return redirect('login')

    access_token = request.session.get('access')
    profile_id = request.session.get('profile_id')

    if not profile_id:
        messages.error(request, "Profile ID not found.")
        return redirect('login')

    headers = {'Authorization': f'Bearer {access_token}'}

    # Fetch profile data
    profile_data = {}
    try:
        profile_url = f'http://127.0.0.1:8001/profile/profile/{profile_id}/'
        profile_response = requests.get(profile_url, headers=headers)
        if profile_response.status_code == 200:
            profile_data = profile_response.json().get('data', {})
        else:
            messages.error(request, "Failed to fetch profile data.")
    except Exception as e:
        print("Profile fetch error:", str(e))
        messages.error(request, "Error occurred while fetching profile.")

    if not profile_data.get('profile_picture'):
        profile_data['profile_picture'] = '/static/images/profile-pic.png'
    if not profile_data.get('cover_picture'):
        profile_data['cover_picture'] = '/static/images/cover.png'

    # ✅ Fetch actual posts from API
    posts = []
    try:
        posts_url = f'http://127.0.0.1:8001/media/profile-posts/profile-id/{profile_id}/'  # ← use f-string here
        posts_response = requests.get(posts_url, headers=headers)
        if posts_response.status_code == 200:
            posts_data = posts_response.json().get('data', [])
            for post in posts_data:
                posts.append({
                    "username": post.get('username'),
                    "profile_picture": profile_data.get('profile_picture', ''),
                    "created_at": post.get('created_at'),
                    "title": post.get('title'),
                    "caption": post.get('caption'),
                    "media": [f"http://127.0.0.1:8001{m.get('file')}" for m in post.get('media', [])],  # Media URLs
                    "reaction_count": post.get('reaction_count', 0),
                    "comment_count": post.get('comment_count', 0),
                    "share_count": post.get('share_count', 0),
                })
        else:
            messages.error(request, "Failed to fetch posts.")
    except Exception as e:
        print("Post fetch error:", str(e))
        messages.error(request, "Error occurred while fetching posts.")

    photos = []
    try:
        photos_url = f'http://127.0.0.1:8001/media/profile-images/profile-id/{profile_id}/'
        photos_response = requests.get(photos_url, headers=headers)
        if photos_response.status_code == 200:
            photos_data = photos_response.json().get('data', [])
            for item in photos_data:
                file_url = item.get('file')
                if file_url:
                    photos.append(f"http://127.0.0.1:8001{file_url}")
        else:
            print("Photo fetch failed:", photos_response.status_code)
    except Exception as e:
        print("Photo fetch error:", str(e))




    return render(request, 'Facebook-Clone-main/user.html', {
        'profile': profile_data,
        'username': request.session.get('username'),
        'email': request.session.get('email'),
        'photos': photos,
        'posts': posts,
    })


def register_organization_view(request):
    if request.method == 'POST':
        form = OrganizationRegistrationForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data
            payload = {
                "email": data['email'],
                "password": data['password'],
                "otp": data['otp'],
                "name": data['name'],
                "phone_number": data['phone_number'],
            }

            response = requests.post('http://127.0.0.1:8001/organization/register-organization/', json=payload)

            if response.status_code == 201:
                messages.success(request, "Organization registered successfully.")
                return redirect('login')
            else:
                error_msg = response.json().get('message', 'Registration failed.')
                messages.error(request, error_msg)
    else:
        form = OrganizationRegistrationForm()

    return render(request, 'register_organization.html', {'form': form})

@csrf_exempt
def add_profile_field(request):
    if request.method == 'POST':
        access_token = request.session.get('access')
        profile_id = request.session.get('profile_id')
        if not (access_token and profile_id):
            return redirect('login')

        field_type = request.POST.get('field_type')
        field_name = request.POST.get('field_name')

        data = {
            "field_type": field_type,
            "field_name": field_name,
            "text_value": request.POST.get('text_value') if field_type == 'text' else None,
            "date_value": request.POST.get('date_value') if field_type == 'date' else None,
        }
        files = {}
        if field_type == 'image':
            image = request.FILES.get('image_value')
            if image:
                files['image_value'] = image
        if field_type == 'file':
            file = request.FILES.get('file_value')
            if file:
                files['file_value'] = file

        url = f"http://127.0.0.1:8001/profile/profile-fields/{profile_id}/"
        headers = {'Authorization': f'Bearer {access_token}'}

        response = requests.post(url, headers=headers, data=data, files=files)

        return redirect('dashboard')  # or the correct route

    return redirect('dashboard')

@csrf_protect
def create_post_view(request):
    if request.method == 'POST':
        access_token = request.session.get('access')
        if not access_token:
            messages.error(request, "Access token missing. Please login again.")
            return redirect('login')

        url = 'http://127.0.0.1:8001/media/post/'
        headers = {'Authorization': f'Bearer {access_token}'}

        files = request.FILES.getlist('media_files')
        form_data = {
            'profile_id': request.POST.get('profile_id'),
            'title': request.POST.get('title', ''),
            'content': request.POST.get('content', ''),
            'caption': request.POST.get('caption', '')
        }

        multipart_data = [('media_files', f) for f in files]

        try:
            response = requests.post(url, data=form_data, files=multipart_data, headers=headers)
            if response.status_code == 201:
                messages.success(request, "Post created successfully.")
            else:
                messages.error(request, f"Failed to post: {response.json()}")
        except Exception as e:
            messages.error(request, f"An error occurred: {str(e)}")

        return redirect('dashboard')  # or wherever the posts appear

    return redirect('dashboard')

def forgot_password_view(request):
    return render(request, 'Facebook-Clone-main/forgot_password.html')

def reset_password_page(request):
    return render(request, 'Facebook-Clone-main/reset_password.html')