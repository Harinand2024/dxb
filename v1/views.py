from django.shortcuts import render, get_object_or_404
import requests
from django.shortcuts import redirect, render
from django.contrib import messages 
from .forms import *
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.csrf import csrf_protect
from django.http import JsonResponse

# Create your views here.
def home(request):
    if not request.session.get('access'):
        return redirect('login')

    access_token = request.session.get('access')
    profile_id = request.session.get('profile_id')

    if not profile_id:
        messages.error(request, "Profile ID not found.")
        return redirect('login')

    headers = {'Authorization': f'Bearer {access_token}'}

    # Fetch posts
    response = requests.get('http://127.0.0.1:8001/media/all-posts/', headers=headers)
    posts = []
    if response.status_code == 200:
        posts = response.json().get('data', [])
        for post in posts:
            post['media'] = [
                f"http://127.0.0.1:8001{m['file']}" for m in post.get('media', [])
            ]
            post['profile_picture'] = (
                f"http://127.0.0.1:8001/media/{post['profile_picture']}"
                if post.get('profile_picture')
                else '/static/images/profile_picture.png'
            )

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

    # ✅ Fetch intro fields


    return render(request, 'home.html', {
        'posts': posts,
        'profile': profile_data,

    })




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

    intro_sections = []
    try:
        profile_url = f'http://127.0.0.1:8001/profile/profile/{profile_id}/'
        profile_response = requests.get(profile_url, headers=headers)
        if profile_response.status_code == 200:
            profile_json = profile_response.json().get('data', {})
            profile_data.update(profile_json)  # merge fields into existing dict

            # Parse the field_sections from profile
            for section in profile_json.get('field_sections', []):
                intro_sections.append({
                    'id': section['id'],
                    'title': section['title'],
                    'display_order': section['display_order'],
                    'fields': section.get('fields', [])
                })
        else:
            messages.error(request, "Failed to fetch profile data.")
    except Exception as e:
        print("Intro section fetch error:", str(e))
        messages.error(request, "Error occurred while fetching intro sections.")

    posts = []
    try:
        posts_url = f'http://127.0.0.1:8001/media/profile-posts/profile-id/{profile_id}/'  # ← use f-string here
        posts_response = requests.get(posts_url, headers=headers)
        if posts_response.status_code == 200:
            posts_data = posts_response.json().get('data', [])
            for post in posts_data:
                posts.append({
                    "id": post.get('id'),
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




    return render(request, 'user3.html', {
        'profile': profile_data,
        'username': request.session.get('username'),
        'email': request.session.get('email'),
        'photos': photos,
        'posts': posts,
        'intro_sections': intro_sections
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


def profile_dashboard_view(request, profile_id):
    access_token = request.session.get('access')
    if not access_token:
        return JsonResponse({'error': 'Authentication required'}, status=401)

    headers = {'Authorization': f'Bearer {access_token}'}
    base_url = 'http://127.0.0.1:8001'

    data = {
        'profile': {},
        'intro_sections': [],
        'posts': [],
        'photos': [],
    }

    # === 1. Profile Fetch ===
    try:
        profile_url = f'{base_url}/profile/profile/{profile_id}/'
        profile_response = requests.get(profile_url, headers=headers)
        profile_json = profile_response.json()

        if profile_response.status_code == 200 and 'data' in profile_json:
            profile_data = profile_json['data']
            data['profile'] = profile_data
        else:
            return JsonResponse({'error': 'Failed to fetch profile', 'details': profile_json}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'Profile fetch error: {str(e)}'}, status=500)

    # === 2. Intro Sections ===
    for section in data['profile'].get('field_sections', []):
        data['intro_sections'].append({
            'id': section['id'],
            'title': section['title'],
            'display_order': section['display_order'],
            'fields': section.get('fields', [])
        })

    # === 3. Posts ===
    try:
        posts_url = f'{base_url}/media/profile-posts/profile-id/{profile_id}/'
        posts_response = requests.get(posts_url, headers=headers)
        posts_json = posts_response.json()

        if posts_response.status_code == 200:
            posts_data = posts_json.get('data', [])
            data['posts'] = [{
                'id': post['id'],
                'username': post.get('username'),
                "profile_picture": profile_data.get('profile_picture', ''),
                'created_at': post.get('created_at'),
                'title': post.get('title'),
                'caption': post.get('caption'),
                'reaction_count': post.get('reaction_count', 0),
                'comment_count': post.get('comment_count', 0),
                'share_count': post.get('share_count', 0),
                'media': [f"{base_url}{m.get('file')}" for m in post.get('media', [])]
            } for post in posts_data]
        else:
            print(f"Post fetch failed: {posts_response.status_code} - {posts_response.text}")
    except Exception as e:
        print(f"Post fetch error: {e}")

    # === 4. Photos ===
    try:
        photos_url = f'{base_url}/media/profile-images/profile-id/{profile_id}/'
        photos_response = requests.get(photos_url, headers=headers)
        photos_json = photos_response.json()

        if photos_response.status_code == 200:
            for item in photos_json.get('data', []):
                file_url = item.get('file')
                if file_url:
                    data['photos'].append(f"{base_url}{file_url}")
        else:
            print(f"Photo fetch failed: {photos_response.status_code} - {photos_response.text}")
    except Exception as e:
        print(f"Photo fetch error: {e}")

    return render(request, 'profile_id.html', {
        'profile': data['profile'],
        'intro_sections': data['intro_sections'],
        'posts': data['posts'],
        'photos': data['photos'],
    })