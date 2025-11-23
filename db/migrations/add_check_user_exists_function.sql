-- Function to check if a user exists by email
-- This is needed because auth.users is not directly accessible from the client
CREATE OR REPLACE FUNCTION check_user_exists(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO user_count
  FROM auth.users
  WHERE email = user_email;
  
  RETURN user_count > 0;
END;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION check_user_exists(TEXT) TO authenticated, anon;
