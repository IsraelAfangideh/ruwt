-- Add timezone column to profiles for timezone-aware email delivery
ALTER TABLE profiles ADD COLUMN timezone TEXT;
