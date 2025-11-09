-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;

-- Create a more permissive policy that allows users to view conversations they're creating
CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      -- Allow viewing if user is a participant
      EXISTS (
        SELECT 1 FROM public.conversation_participants
        WHERE conversation_id = conversations.id
        AND user_id = auth.uid()
      )
      -- OR if the conversation was just created (within last 5 seconds) and has no participants yet
      OR (
        created_at > now() - interval '5 seconds'
        AND NOT EXISTS (
          SELECT 1 FROM public.conversation_participants
          WHERE conversation_id = conversations.id
        )
      )
    )
  );