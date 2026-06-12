insert into public.cinema_validator_permissions (
  id,
  cinema_id,
  validator_user_id,
  granted_by_user_id,
  granted_at,
  revoked_at
)
select
  gen_random_uuid(),
  c.id,
  p.user_id,
  null,
  now(),
  null
from public.profiles p
cross join public.cinemas c
where p.role::text = 'validator'
  and c.is_active = true
on conflict (cinema_id, validator_user_id)
do update set
  revoked_at = null;
