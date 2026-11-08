-- The admin may delete uploaded files (e.g. when cleaning up a client's materials)
create policy private_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'private' and private.is_admin());
