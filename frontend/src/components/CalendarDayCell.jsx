// CalendarDayCell.jsx — respresents a single day in the month grid (Owner: Member C).
// Shows the date number and a few event pills. Extra events collapse to "+N more".

import { Link } from 'react-router-dom';

const MAX_PILLS = 3;

export default function CalendarDayCell({ date, events = [], participating = false, today = false }) {
  const shown = events.slice(0, MAX_PILLS);
  const extra = events.length - shown.length;

  return (
    <div
      className={`cal-cell${today ? ' cal-cell--today' : ''}${participating ? ' cal-cell--rsvp' : ''}`}
      role="gridcell"
    >
      <span className="cal-cell__num">{date.date()}</span>
      <div className="cal-cell__events">
        {shown.map((e) => (
          <Link key={e.id} to={`/events/${e.id}`} className="cal-pill" title={e.title}>
            {e.title}
          </Link>
        ))}
        {extra > 0 && <span className="cal-cell__more">+{extra} more</span>}
      </div>
    </div>
  );
}
