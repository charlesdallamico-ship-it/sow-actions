-- Todo fato deve estar ligado a um objetivo estratégico.
ALTER TABLE public.facts
  ALTER COLUMN objective_id SET NOT NULL;
