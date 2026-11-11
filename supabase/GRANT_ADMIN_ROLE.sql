-- Run this after the Auth user has been created in Supabase Dashboard.
-- The raw_app_meta_data role is trusted by /login-admin; user-editable metadata is not.
update auth.users
set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('full_name', 'Admin SehatiKan'),
    raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'admin')
where lower(email) = lower('admin@sehatikan');

-- Verify exactly one account was updated:
select email, raw_user_meta_data ->> 'full_name' as display_name,
       raw_app_meta_data ->> 'role' as app_role
from auth.users
where lower(email) = lower('admin@sehatikan');
