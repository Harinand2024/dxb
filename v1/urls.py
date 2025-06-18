from django.urls import path
from .views import *

urlpatterns = [
    path('home/', home, name='home'),
    path('login/', login_page_view,name='login'),
    path('logout/', logout_view, name='logout'),
    path('dashboard/', dashboard_view, name='dashboard'),
    path('profile-dashboard/<int:profile_id>/', profile_dashboard_view, name='profile-dashboard-api'),
    path('register/', register_organization_view, name='register'),
    path('add-profile-field/', add_profile_field, name='add_profile_field'),
    path('create-post/', create_post_view, name='create_post'),
    path('forgot-password/', forgot_password_view, name='forgot_password'),
    path('reset-password/', reset_password_page, name='reset_password_page'),
]