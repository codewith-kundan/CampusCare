-- ==============================================================================
-- NITR CAMPUSCARE — DATABASE MIGRATION SCRIPT
-- Run this in your Supabase SQL Editor to enable full grievance tracking.
-- ==============================================================================

-- 1. Ensure complaints table has all required columns
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_name TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Submitted',
    location TEXT,
    evidence_path TEXT,
    teacher_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Safely add any columns if the complaints table was created earlier with fewer fields
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='location') THEN
        ALTER TABLE public.complaints ADD COLUMN location TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='priority') THEN
        ALTER TABLE public.complaints ADD COLUMN priority TEXT DEFAULT 'Medium';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='evidence_path') THEN
        ALTER TABLE public.complaints ADD COLUMN evidence_path TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='complaints' AND column_name='teacher_notes') THEN
        ALTER TABLE public.complaints ADD COLUMN teacher_notes TEXT;
    END IF;
END $$;

-- 2. Create the complaint_status_history audit table
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    note TEXT,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable Row Level Security
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;

-- 4. Policies for complaints table
-- Students can insert their own complaints
CREATE POLICY "Students can insert their own complaints"
    ON public.complaints
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Students can read their own complaints
CREATE POLICY "Students can view their own complaints"
    ON public.complaints
    FOR SELECT
    USING (auth.uid() = user_id OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'teacher'));

-- Admins and Teachers can update complaints
CREATE POLICY "Admins can update all complaints"
    ON public.complaints
    FOR UPDATE
    USING ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'teacher') OR auth.uid() = user_id);

-- 5. Policies for complaint_status_history
-- Users can view history of their own complaints
CREATE POLICY "Users can view status history of their own complaints"
    ON public.complaint_status_history
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.complaints c
            WHERE c.id = complaint_status_history.complaint_id
            AND (c.user_id = auth.uid() OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'teacher'))
        )
    );

-- Allow authenticated users to insert status history
CREATE POLICY "Users and admins can insert status history"
    ON public.complaint_status_history
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 6. Normalize existing Priority values
UPDATE public.complaints SET priority = 'Critical' WHERE priority = 'Urgent';
