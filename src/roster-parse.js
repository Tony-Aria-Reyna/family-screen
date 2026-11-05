/* Family Screen — reads an airline crew roster PDF (Jetnet "Operational Roster" layout) into flights and duties.
   Input: the text lines of the PDF (each line = the text items of one row joined left to right).
   All roster times are LOCAL to the airport in that row; they are turned into real moments in time here. */
function parseRosterLines(lines, opts) {
  const AP = opts.airports, tzOf = c => (AP[c] ? AP[c][1] : null);
  const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  const pad = n => String(n).padStart(2, '0');
  function offsetMin(tz, d) {
    const o = {}; new Intl.DateTimeFormat('en-NZ', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(d).forEach(p => o[p.type] = p.value);
    return Math.round((Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour % 24, +o.minute, +o.second) - d.getTime()) / 6e4);
  }
  function local(dateKey, hhmm, tz) { // "2026-11-06","1900","Pacific/Auckland" -> Date
    const [y, m, d] = dateKey.split('-').map(Number), h = +hhmm.slice(0, 2), mi = +hhmm.slice(2, 4);
    let t = Date.UTC(y, m - 1, d, h, mi); t -= offsetMin(tz, new Date(t)) * 6e4; t = Date.UTC(y, m - 1, d, h, mi) - offsetMin(tz, new Date(t)) * 6e4;
    return new Date(t);
  }
  const addDay = (k, n) => { const [y, m, d] = k.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, d + n)); return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate()); };

  // the year: rows only say "Fri-06Nov", so use the print date ("Printed on 02-Nov-26")
  let ref = new Date();
  for (const l of lines) { const m = l.match(/Printed on (\d{2})-([A-Z][a-z]{2})-(\d{2})/); if (m) { ref = new Date(2000 + +m[3], MON[m[2]], +m[1]); break; } }
  const keyFor = (dd, mon) => { let best = null; for (const y of [ref.getFullYear() - 1, ref.getFullYear(), ref.getFullYear() + 1]) { const d = new Date(y, MON[mon], +dd); if (!best || Math.abs(d - ref) < Math.abs(best - ref)) best = d; } return best.getFullYear() + '-' + pad(best.getMonth() + 1) + '-' + pad(best.getDate()); };
  const name = (lines.find(l => /Name\s*:/.test(l)) || '').replace(/.*Name\s*:\s*/, '').replace(/\s*\(.*$/, '').replace(/\s{2,}.*/, '').trim();

  const legs = [], duties = [], warnings = [], dates = [];
  let cur = null, open = null, prevTrip = null;
  for (const raw of lines) {
    if (raw.indexOf('│') < 0) continue;
    const c = raw.split('│').map(s => s.trim());
    if (c.length < 15) continue;
    const [, dateC, dutyC, actC, acC, secC, pickC, repC, etdC, etaC, ftC, , , , notesC] = c;
    if (/^[-=]+$/.test(dateC) || /DATE|LOCAL/.test(dateC)) continue;
    const dm = dateC.match(/^[A-Z][a-z]{2}-(\d{2})([A-Z][a-z]{2})$/);
    if (dm) { cur = keyFor(dm[1], dm[2]); dates.push(cur); }
    if (!cur) { if (/^[A-Z]{3}\d+/.test(dutyC) && /previous roster/i.test(notesC)) prevTrip = dutyC.slice(0, 3); continue; }
    const codes = (secC.match(/\b[A-Z]{3}\b/g) || []);
    const rep = repC.match(/^(\d{4})?\s*\/\s*(\d{4})?$/) || [];
    const t4 = s => (s.match(/^\d{4}$/) || [null])[0];
    const etd = t4(etdC), eta = t4(etaC), pickup = t4(pickC);
    const hotel = (notesC.match(/HTL:\s*(.+)/) || [])[1] || '';
    const fl = actC.match(/^(?:[A-Z]{0,2})?NZ\s?(\d{1,4})[A-Z]?$/);
    if (fl) {
      const flight = 'NZ' + fl[1];
      if (codes.length >= 2 && etd && eta) {                 // whole sector on one line, e.g. NZ103 AKL SYD 0900 1035
        const [from, to] = codes; const tf = tzOf(from), tt = tzOf(to);
        if (!tf || !tt) { warnings.push(`${cur}: ${flight} ${from}-${to}: unknown airport`); continue; }
        const dep = local(cur, etd, tf); let arr = local(cur, eta, tt); let k = cur; while (arr <= dep) { k = addDay(k, 1); arr = local(k, eta, tt); }
        legs.push({ flight, from, to, dep, arr, report: rep[1] ? local(cur, rep[1], tf) : null, signOut: rep[2] ? local(k, rep[2], tt) : null, pickup: pickup ? local(cur, pickup, tf) : null, hotel, ac: acC });
      } else if (codes.length >= 1 && etd) {                 // departure now, arrival on a later line
        open = { flight, from: codes[0], depKey: cur, etd, report: rep[1] || null, pickup, hotel, ac: acC };
      } else warnings.push(`${cur}: couldn't read ${flight}`);
      continue;
    }
    if (!actC && codes.length === 1 && eta) {                  // arrival line of a long flight
      const to = codes[0], tt = tzOf(to);
      if (!tt) { warnings.push(`${cur}: unknown airport ${to}`); open = null; continue; }
      const arr = local(cur, eta, tt), signOut = rep[2] ? local(cur, rep[2], tt) : null;
      if (open) {
        const tf = tzOf(open.from); if (!tf) { warnings.push(`${open.depKey}: unknown airport ${open.from}`); open = null; continue; }
        legs.push({ flight: open.flight, from: open.from, to, dep: local(open.depKey, open.etd, tf), arr, report: open.report ? local(open.depKey, open.report, tf) : null, signOut, pickup: open.pickup ? local(open.depKey, open.pickup, tf) : null, hotel: open.hotel, ac: open.ac });
        open = null;
      } else {                                                 // landed from a trip on the previous roster
        const m = ftC.match(/(\d+):(\d{2})/), from = prevTrip && AP[prevTrip] ? prevTrip : null;
        if (m && from) legs.push({ flight: '', from, to, dep: new Date(arr - (+m[1] * 60 + +m[2]) * 6e4), arr, signOut, report: null, pickup: null, hotel: '', ac: '', fromPrevious: true });
        else warnings.push(`${cur}: arrival at ${to} with no departure`);
      }
      continue;
    }
    const DAYS_OFF = ['LOF'];                                  // roster codes that just mean a day off
    if (actC && !/^[\/\\]$/.test(actC) && !DAYS_OFF.includes(actC) && /^[A-Z][A-Z0-9-]{1,9}$/.test(actC)) {  // other duties: training, standby, leave…
      const venue = (notesC.match(/Venue:\s*(.+)/) || [])[1] || '';
      const s = rep[1], e = rep[2];
      const allDay = !s || s === '0000' && (!e || e === '2359');
      duties.push({ date: cur, code: actC, duty: dutyC, start: allDay ? '' : s.slice(0, 2) + ':' + s.slice(2), end: allDay || !e ? '' : e.slice(0, 2) + ':' + e.slice(2), venue });
    }
  }
  if (open) warnings.push(`${open.depKey}: ${open.flight} from ${open.from} — arrival not on this roster`);
  return { name, legs, duties, warnings, first: dates[0] || null, last: dates[dates.length - 1] || null };
}
if (typeof module !== 'undefined') module.exports = { parseRosterLines };
