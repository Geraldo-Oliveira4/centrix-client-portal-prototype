import HabitualPreview from './habitual-preview';
export default function Page({
  searchParams,
}: {
  searchParams: { entrada?: string };
}) {
  return <HabitualPreview initialEntry={searchParams.entrada || 'nova'} />;
}
