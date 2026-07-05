import { Cake } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

/** Needs the Members module's date-of-birth data — placeholder until then. */
export function UpcomingBirthdays() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upcoming Birthdays</CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState icon={Cake} title="Available once Members go live" />
      </CardContent>
    </Card>
  );
}
