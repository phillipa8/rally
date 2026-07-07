// CalendarDayCell.jsx — respresents a single day in the month grid (Owner: Member C).
// Shows the date number and a few event pills. Extra events collapse to "+N more".
// Tapping the cell toggles day selection (mobile agenda scope). On desktop the
// pills are links, so their clicks must not bubble into the selection toggle;
// on mobile the dots are pointer-inert (see .cal-pill) and taps select the day.

import { Link } from 'react-router-dom';

const MAX_PILLS = 3;

export default function CalendarDayCell({
  date,
  events = [],
  participating = false,
  today = false,
  selected = false,
  onSelect,
}) {
  const shown = events.slice(0, MAX_PILLS);
  const extra = events.length - shown.length;

  return (
    <div
      className={`cal-cell${today ? ' cal-cell--today' : ''}${participating ? ' cal-cell--rsvp' : ''}${selected ? ' cal-cell--selected' : ''}`}
      role="gridcell"
      aria-selected={selected}
      onClick={onSelect}
    >
      <span className="cal-cell__num">{date.date()}</span>
      <div className="cal-cell__events">
        {shown.map((e) => (
          <Link
            key={e.id}
            to={`/events/${e.id}`}
            className="cal-pill"
            title={e.title}
            onClick={(event) => event.stopPropagation()}
          >
            {e.title}
          </Link>
        ))}
        {extra > 0 && <span className="cal-cell__more">+{extra} more</span>}
      </div>
    </div>
  );
}
