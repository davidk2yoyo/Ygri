-- Add project_id column to email_threads table
-- This allows emails to be manually attached to projects

ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES tracks(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_email_threads_project ON email_threads(project_id) WHERE project_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN email_threads.project_id IS 'Optional link to a project (track). Allows manually attaching emails to projects.';
