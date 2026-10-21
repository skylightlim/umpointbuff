import { Booking, CourtId, GridResponse, GridSlot, SlotStatus, WeekType } from '../types';

export const COURTS: Record<CourtId, string> = {
  '1': '21201',
  '2': '21199',
  '3': '21203',
  '4': '21205',
};

export const COURT_NAMES: Record<string, string> = {
  '21201': 'Gelanggang Badminton 1',
  '21199': 'Gelanggang Badminton 2',
  '21203': 'Gelanggang Badminton 3',
  '21205': 'Gelanggang Badminton 4',
};

export const BASE_URL = 'https://umpoint.um.edu.my';

export function to24(t: string): string {
  t = t.trim().toLowerCase();
  const pm = t.endsWith('pm');
  const am = t.endsWith('am');
  t = t.replace(/(am|pm)/g, '').trim();
  const parts = t.split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function slotRange(start: string, end: string): string[] {
  const s = to24(start);
  const e = to24(end);
  const [sh, sm] = s.split(':').map((x) => parseInt(x, 10));
  const [eh, em] = e.split(':').map((x) => parseInt(x, 10));

  if (eh * 60 + em <= sh * 60 + sm) {
    throw new Error('End time must be after start time');
  }

  const out: string[] = [];
  let cur = sh * 60 + sm;
  while (cur < eh * 60 + em) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    out.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    cur += 30;
  }
  return out;
}

export function parseGrid(html: string, court: CourtId = '1', week: WeekType = 'this'): GridResponse {
  const monthMap: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };

  const headerDates: string[] = [];
  const headerRegex = /<td[^>]*>(?:[A-Za-z]+\s*<br\s*\/?>\s*)?(\d{1,2})\s+([A-Za-z]{3}),\s+(\d{4})<\/td>/g;
  let match: RegExpExecArray | null;
  while ((match = headerRegex.exec(html)) !== null) {
    const d = match[1].padStart(2, '0');
    const m = monthMap[match[2]] || '10';
    const y = match[3];
    headerDates.push(`${d}-${m}-${y}`);
  }

  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  const dataTrs: { start24: string; end24: string; tr: string }[] = [];
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const tr = trMatch[1];
    const timeMatch = tr.match(/<td class="header">(\d{1,2}:\d{2}\s*(?:am|pm))\s*-\s*(\d{1,2}:\d{2}\s*(?:am|pm))<\/td>/i);
    if (timeMatch) {
      dataTrs.push({
        start24: to24(timeMatch[1]),
        end24: to24(timeMatch[2]),
        tr,
      });
    }
  }

  const numRows = dataTrs.length;
  const numCols = headerDates.length;
  const gridMatrix: (any | null)[][] = Array.from({ length: numRows }, () => Array(numCols).fill(null));

  dataTrs.forEach((dataTr, rIdx) => {
    const tdRegex = /<td([^>]*)>([\s\S]*?)<\/td>/g;
    const tds: { attr: string; content: string }[] = [];
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(dataTr.tr)) !== null) {
      tds.push({ attr: tdMatch[1], content: tdMatch[2] });
    }
    const dataTds = tds.slice(1);
    let tdPtr = 0;
    let cIdx = 0;

    while (cIdx < numCols) {
      if (gridMatrix[rIdx][cIdx] !== null) {
        cIdx++;
        continue;
      }
      if (tdPtr < dataTds.length) {
        const td = dataTds[tdPtr++];
        const classM = td.attr.match(/class="([^"]*)"/);
        const idM = td.attr.match(/id="([^"]*)"/);
        const rowspanM = td.attr.match(/rowspan="([^"]*)"/);
        const cls = classM ? classM[1] : '';
        const cid = idM ? idM[1] : '';
        const rowspan = rowspanM ? parseInt(rowspanM[1], 10) : 1;

        const isFree = cls.includes('cursorpointer') && Boolean(cid);
        const status: SlotStatus = isFree
          ? 'free'
          : cls.includes('pending')
          ? 'pending'
          : cls.includes('booked')
          ? 'booked'
          : cls.includes('closecols')
          ? 'closed'
          : 'booked';

        const cellInfo = {
          date: headerDates[cIdx],
          time_start: dataTr.start24,
          time_end: dataTr.end24,
          status,
          cell_id: cid,
          text: td.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        };

        for (let span = 0; span < rowspan; span++) {
          if (rIdx + span < numRows) {
            gridMatrix[rIdx + span][cIdx] = cellInfo;
          }
        }
        cIdx++;
      } else {
        cIdx++;
      }
    }
  });

  const slots: GridSlot[] = dataTrs.map((dataTr, rIdx) => ({
    time_start: dataTr.start24,
    time_end: dataTr.end24,
    cells: headerDates.map((_, cIdx) => gridMatrix[rIdx][cIdx] || {
      date: headerDates[cIdx],
      time_start: dataTr.start24,
      time_end: dataTr.end24,
      status: 'unavailable' as SlotStatus,
      cell_id: '',
      text: '',
    }),
  }));

  const todayMatch = html.match(/name="initdate"[^>]*value="([^"]*)"/);
  const serverToday = todayMatch ? todayMatch[1] : headerDates[0] || '';

  return {
    court,
    court_name: COURT_NAMES[COURTS[court]] || `Court ${court}`,
    week,
    dates: headerDates,
    slots,
    server_today: serverToday,
  };
}

export function freeSlots(grid: GridResponse, dateStr: string, start: string, end: string) {
  const colIdx = grid.dates.indexOf(dateStr);
  if (colIdx === -1) {
    return { ok: false, busy: [`Date ${dateStr} not in view`], cells: [] };
  }

  const wanted = slotRange(start, end);
  const rowByTime: Record<string, number> = {};
  grid.slots.forEach((s, idx) => {
    rowByTime[s.time_start] = idx;
  });

  const busy: string[] = [];
  const cells: any[] = [];

  for (const w of wanted) {
    if (rowByTime[w] === undefined) {
      busy.push(`${w} (outside schedule)`);
      continue;
    }
    const rIdx = rowByTime[w];
    const cell = grid.slots[rIdx].cells[colIdx];
    if (cell && cell.status === 'free' && cell.cell_id) {
      cells.push(cell);
    } else {
      const status = cell?.status || 'booked';
      busy.push(`${w} (${status})`);
    }
  }

  return { ok: busy.length === 0, busy, cells };
}

export function parseDashboard(html: string): Booking[] {
  const bookings: Booking[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let trM: RegExpExecArray | null;

  while ((trM = trRegex.exec(html)) !== null) {
    const tr = trM[1];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const tds: string[] = [];
    let tdM: RegExpExecArray | null;
    while ((tdM = tdRegex.exec(tr)) !== null) {
      const cleanText = tdM[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      tds.push(cleanText);
    }

    if (tds.length >= 5 && !tds.join(' ').toLowerCase().includes('no record')) {
      const cancelM = tr.match(/btncancel(?:reason)?\(['"]?(\d+)['"]?\)/);
      const cancelId = cancelM ? cancelM[1] : '';
      bookings.push({
        num: tds[0] || '',
        invoice: tds[1] || '',
        facility: tds[2] || '',
        booking_date: tds[3] || '',
        event_date: tds[4] || '',
        status: cancelId ? 'Pending Decision' : 'Confirmed',
        cancel_id: cancelId,
      });
    }
  }

  return bookings;
}

export function getWeekTimestamps(): { thisWeekTs: number; nextWeekTs: number } {
  // Current time in Malaysia Time (UTC+8)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const myt = new Date(utc + 3600000 * 8);

  const dayOfWeek = (myt.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  const monThis = new Date(myt);
  monThis.setDate(myt.getDate() - dayOfWeek);
  monThis.setHours(0, 0, 0, 0);

  const monNext = new Date(monThis);
  monNext.setDate(monThis.getDate() + 7);

  return {
    thisWeekTs: Math.floor(monThis.getTime() / 1000),
    nextWeekTs: Math.floor(monNext.getTime() / 1000),
  };
}

// Direct HTTP Calls to UMPoint
export async function fetchGridDirect(
  court: CourtId = '1',
  week: WeekType = 'this',
  cookieString: string
): Promise<GridResponse> {
  const { thisWeekTs, nextWeekTs } = getWeekTimestamps();
  const weekTs = week === 'this' ? thisWeekTs : nextWeekTs;
  const calflag = week === 'this' ? 't' : 'n';
  const spid = COURTS[court] || COURTS['1'];

  const now = new Date();
  const nowMyt = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 3600000 * 8);
  const todayStr = `${nowMyt.getDate().toString().padStart(2, '0')}-${(nowMyt.getMonth() + 1).toString().padStart(2, '0')}-${nowMyt.getFullYear()}`;

  const body = new URLSearchParams({
    act: 'bookweek',
    doproc: '0',
    spid,
    mid: '8',
    theday: String(weekTs),
    calflag,
    initdate: todayStr,
    recnum: '0',
    inputo: 'sdbook',
  }).toString();

  const res = await fetch(`${BASE_URL}/modules/mbook/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieString,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    },
    body,
  });

  const html = await res.text();
  return parseGrid(html, court, week);
}

export async function submitBookingDirect(
  payload: {
    date: string;
    start: string;
    end: string;
    court: CourtId;
    event: string;
    pax: number;
    startCellId: string;
    endCellId: string;
  },
  cookieString: string
): Promise<{ success: boolean; message: string }> {
  const { thisWeekTs, nextWeekTs } = getWeekTimestamps();
  const spid = COURTS[payload.court];

  const now = new Date();
  const nowMyt = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 3600000 * 8);
  const todayStr = `${nowMyt.getDate().toString().padStart(2, '0')}-${(nowMyt.getMonth() + 1).toString().padStart(2, '0')}-${nowMyt.getFullYear()}`;

  const body = new URLSearchParams({
    sdbook: payload.date,
    edbook: payload.date,
    stbook: payload.start,
    etbook: payload.end,
    event: payload.event,
    pax: String(payload.pax),
    term: 'on',
    has_upfile: '1',
    act: 'bookweek',
    doproc: '1',
    spid,
    mid: '8',
    theday: String(thisWeekTs),
    calflag: 't',
    initdate: todayStr,
    stdateselected: payload.startCellId,
    eddateselected: payload.endCellId,
    'ritem[]': '0',
  }).toString();

  const res = await fetch(`${BASE_URL}/modules/mbook/index.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieString,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    },
    body,
  });

  const html = await res.text();

  const failMatch = html.match(/Reservation failed\s*!([^<]*)/);
  if (failMatch) {
    return { success: false, message: `Reservation failed: ${failMatch[1].trim()}` };
  }

  const alertMatch = html.match(/class="alert alert-danger"[^>]*>([\s\S]*?)<\/div>/);
  if (alertMatch) {
    const msg = alertMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return { success: false, message: msg };
  }

  // Verify by fetching dashboard
  const bookings = await getBookingsDirect(cookieString);
  const dSlash = payload.date.replace(/-/g, '/');
  const confirmed = bookings.some(
    (b) => (b.event_date.includes(dSlash) || b.event_date.includes(payload.date)) && b.facility.includes(payload.court)
  );

  if (confirmed) {
    return { success: true, message: `Successfully booked Court ${payload.court} for ${payload.date} ${payload.start}-${payload.end}!` };
  }

  return { success: true, message: `Booking submitted for Court ${payload.court} (${payload.date} ${payload.start}-${payload.end}). Check My Bookings to confirm.` };
}

export async function getBookingsDirect(cookieString: string): Promise<Booking[]> {
  const res = await fetch(`${BASE_URL}/modules/dashboard/`, {
    method: 'GET',
    headers: {
      Cookie: cookieString,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    },
  });

  const html = await res.text();
  return parseDashboard(html);
}

export async function cancelBookingDirect(
  bookingId: string,
  cookieString: string
): Promise<{ success: boolean; message: string; remaining: Booking[] }> {
  const body = new URLSearchParams({
    act: 'cancelmodreserve',
    bookmainid: bookingId,
  }).toString();

  await fetch(`${BASE_URL}/modules/dashboard/index.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieString,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    },
    body,
  });

  const remaining = await getBookingsDirect(cookieString);
  const stillExists = remaining.some((b) => b.cancel_id === bookingId);

  return {
    success: !stillExists,
    message: !stillExists ? `Booking #${bookingId} cancelled.` : `Failed to cancel booking #${bookingId}`,
    remaining,
  };
}
