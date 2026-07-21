GRANT INSERT ON public.trace_logs TO anon, authenticated;
GRANT SELECT ON public.trace_logs TO authenticated;
GRANT ALL ON public.trace_logs TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;