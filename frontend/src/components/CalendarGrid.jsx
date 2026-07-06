// CalendarGrid.jsx — a 7 column month grid (Owner: Member C).
// 'month' is a dayjs at the start of the month; 'eventsByDay' maps 'YYYY-MM-DD' to
// events[]; 'participatingDays' is a Set of 'YYYY-MM-DD' the viewer RSVP'd to.

import CalendarDayCell from './CalendarDayCell';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarGrid({ month, eventsByDay, participatingDays, today }) {
  const startOfMonth = month.startOf('month');
  const daysInMonth = month.daysInMonth();
  const leadingBlanks = startOfMonth.day(); // 0 = Sunday

  const cells = [];
  for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(startOfMonth.date(d));

  return (
    <div className="cal-grid" role="grid" aria-label={month.format('MMMM YYYY')}>
      {WEEKDAYS.map((w) => (
        <div key={w} className="cal-grid__head" role="columnheader">
          {w}
        </div>
      ))}
      {cells.map((date, i) => {
        if (!date) return <div key={`blank-${i}`} className="cal-cell cal-cell--blank" />;
        const key = date.format('YYYY-MM-DD');
        return (
          <CalendarDayCell
            key={key}
            date={date}
            events={eventsByDay.get(key) || []}
            participating={participatingDays.has(key)}
            today={today === key}
          />
        );
      })}
    </div>
  );
}
