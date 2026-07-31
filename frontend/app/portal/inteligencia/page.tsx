import { redirect } from 'next/navigation';

/**
 * `/portal/inteligencia` has no screen of its own anymore. The "Visão geral"
 * dashboard that used to live here read only the quotation side; it was merged
 * into Performance, which now answers "estou indo bem?" with quotation AND
 * shipment data in the same place. Nothing was dropped in the merge: the agent
 * wins bar, the status donut and the illustrative savings block moved over as
 * `performance/components/*`.
 *
 * The route stays as a redirect because the sidebar entry points at it and
 * relies on that prefix to stay highlighted across the three dashboards.
 */
export default function InteligenciaIndexPage() {
  redirect('/portal/inteligencia/performance');
}
