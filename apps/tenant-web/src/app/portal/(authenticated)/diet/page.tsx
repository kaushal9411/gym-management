'use client';

import * as React from 'react';
import { Check, Salad, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogDiet, useMemberDiet } from '@/features/member-portal/hooks/use-member-portal';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MemberDietPage() {
  const { data: diet, isLoading } = useMemberDiet();
  const logDiet = useLogDiet();
  const today = todayStr();
  const todaysLog = diet?.dailyLogs.find((l) => l.date === today);
  const [water, setWater] = React.useState('');
  const [weight, setWeight] = React.useState('');

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (!diet) return <EmptyState icon={Salad} title="No diet plan assigned" description="Ask a trainer to assign you one." />;

  const mealsStatus = (todaysLog?.mealsStatus ?? {}) as Record<string, string>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{diet.dietPlan.name}</h1>
        <p className="text-sm text-muted-foreground">
          {diet.dietPlan.dailyCalories ? `${diet.dietPlan.dailyCalories} kcal/day · ` : ''}
          {diet.dietPlan.durationDays} days
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s meals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {diet.dietPlan.mealTypes.map((mealType) => {
            const status = mealsStatus[mealType];
            return (
              <div key={mealType} className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm font-medium">{mealType.replace(/_/g, ' ')}</p>
                <div className="flex items-center gap-2">
                  {status === 'COMPLETED' ? (
                    <Badge variant="success">Done</Badge>
                  ) : status === 'SKIPPED' ? (
                    <Badge variant="secondary">Skipped</Badge>
                  ) : (
                    <>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8 text-success"
                        aria-label={`Mark ${mealType} done`}
                        disabled={logDiet.isPending}
                        onClick={() => logDiet.mutate({ assignmentId: diet.id, input: { date: today, mealsStatus: { [mealType]: 'COMPLETED' } } })}
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="size-8 text-muted-foreground"
                        aria-label={`Mark ${mealType} skipped`}
                        disabled={logDiet.isPending}
                        onClick={() => logDiet.mutate({ assignmentId: diet.id, input: { date: today, mealsStatus: { [mealType]: 'SKIPPED' } } })}
                      >
                        <X className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Water & weight</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="water">Water intake (ml)</Label>
            <div className="flex gap-2">
              <Input id="water" type="number" min={0} value={water} onChange={(e) => setWater(e.target.value)} placeholder={todaysLog?.waterIntakeMl?.toString() ?? '0'} />
              <Button
                disabled={logDiet.isPending || !water}
                onClick={() => {
                  logDiet.mutate({ assignmentId: diet.id, input: { date: today, waterIntakeMl: Number(water) } });
                  setWater('');
                }}
              >
                Save
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="weight">Weight (kg)</Label>
            <div className="flex gap-2">
              <Input id="weight" type="number" min={0} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={todaysLog?.weightKg ?? '0'} />
              <Button
                disabled={logDiet.isPending || !weight}
                onClick={() => {
                  logDiet.mutate({ assignmentId: diet.id, input: { date: today, weightKg: Number(weight) } });
                  setWeight('');
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
