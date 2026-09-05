create policy "Post authors can delete comments on their posts"
on public.comments for delete to authenticated
using (exists (select 1 from public.posts p where p.id = comments.post_id and p.user_id = auth.uid()));