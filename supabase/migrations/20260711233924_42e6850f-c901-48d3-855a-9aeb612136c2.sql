GRANT INSERT ON public.trace_logs TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.trace_logs_id_seq TO anon, authenticated;
GRANT SELECT ON public.trace_logs TO authenticated;
GRANT ALL ON public.trace_logs TO service_role;