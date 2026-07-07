// CalendarDayCell.jsx — respresents a single day in the month grid (Owner: Member C).
// Shows the date number and a few event pills. Extra events collapse to "+N more".
// The whole cell is one click/tap target that toggles day selection (scoping the
// agenda list below the calendar), pills are merely labels indecating 
// the presense of events and events open from the agenda list.

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
          <span key={e.id} className="cal-pill" title={e.title}>
            {e.title}
          </span>
        ))}
        {extra > 0 && <span className="cal-cell__more">+{extra} more</span>}
      </div>
    </div>
  );
}
