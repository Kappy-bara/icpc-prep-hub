create table public.page_views (
    id bigint generated always as identity primary key,
    created_at timestamp with time zone default now() not null,
    path text not null,
    user_id uuid references auth.users
);

alter table public.page_views enable row level security;

create policy "Anyone can insert page views"
    on public.page_views for insert
    with check (true);

