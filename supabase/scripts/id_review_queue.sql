-- OnMyWay · ID review queue (read-only). Run in the SQL editor.
-- Students waiting for a person to look, oldest first. Open each photo in Storage -> id-cards
-- (the file is named by the user id), then decide with:
--   select public.id_review_decide('<user_id>', 'approved', 'reviewer_approved');
--   select public.id_review_decide('<user_id>', 'rejected', 'reviewer_rejected');
select p.id                  as user_id,
       p.full_name,
       p.reg_no,
       p.id_reason,
       'id-cards/' || p.id    as file_path,
       p.id_checked_at,
       p.id_photo_delete_after as photo_deleted_by
  from public.profiles p
 where p.id_status = 'review'
 order by p.id_checked_at asc nulls first;
