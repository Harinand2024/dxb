from django.urls import path
from .views import *

urlpatterns = [
    path('home/', home, name='home'),
    path('login/', login_page_view,name='login'),
    path('logout/', logout_view, name='logout'),
    path('dashboard/', dashboard_view, name='dashboard'),
    path('register/', register_organization_view, name='register'),
    path('add-profile-field/', add_profile_field, name='add_profile_field'),
    path('create-post/', create_post_view, name='create_post'),
]