// Data storage
let trips = JSON.parse(localStorage.getItem('trips')) || [];
let currentTripId = localStorage.getItem('currentTripId') || null;
let packingItems = JSON.parse(localStorage.getItem('packingItems')) || {};
let budgetItems = JSON.parse(localStorage.getItem('budgetItems')) || {};
let receipts = JSON.parse(localStorage.getItem('receipts')) || {};
let documents = JSON.parse(localStorage.getItem('documents')) || {};
let conferenceProgram = JSON.parse(localStorage.getItem('conferenceProgram')) || {};
let agendas = JSON.parse(localStorage.getItem('agendas')) || {};
let agendaPdfs = JSON.parse(localStorage.getItem('agendaPdfs')) || {}; // { [tripId]: [{name, dataUrl}] }

function showIssuesModal() {
    const trip = getCurrentTrip();
    if (!trip) { alert('Please select a trip first'); return; }
    const listEl = document.getElementById('issuesList');
    if (!listEl) return;
    const issues = [];
    // Checklist validations
    const cl = checklists[trip.id] || {};
    const reg = cl.registration || {}; const hotel = cl.hotel || {}; const flight = cl.flight || {};
    if (!reg.date || !reg.conf) issues.push('Registration: missing purchase date or confirmation #.');
    if (!hotel.start || !hotel.end || !hotel.conf) issues.push('Hotel: missing check-in, check-out, or confirmation #.');
    if (!flight.depart || !flight.return || !flight.conf) issues.push('Flights: missing depart date, return date, or confirmation #.');
    // Events vs flights sanity: ensure a flight exists if destination includes comma (city, country)
    if ((trip.destination||'').includes(',') && (!flight.depart || !flight.return)) issues.push('Trip destination set but flight dates are missing.');
    // Receipts: unexpensed after end date window
    const tripEnd = trip.endDate ? new Date(trip.endDate) : null;
    if (tripEnd && receipts[trip.id]) {
        const lagging = receipts[trip.id].filter(r => !r.expensed);
        if (lagging.length > 0 && new Date() - tripEnd > 3*24*60*60*1000) {
            issues.push(`${lagging.length} receipt(s) still unexpensed 3+ days after trip end.`);
        }
    }
    // Events: missing times
    const missingTimes = (trip.events||[]).filter(e => !e.startTime);
    if (missingTimes.length) issues.push(`${missingTimes.length} event(s) missing a start time.`);

    listEl.innerHTML = '';
    if (issues.length === 0) {
        const ok = document.createElement('div');
        ok.textContent = 'No issues found.';
        ok.style.color = '#166534';
        listEl.appendChild(ok);
    } else {
        issues.forEach(msg => {
            const row = document.createElement('div');
            row.style.border = '1px solid var(--border)';
            row.style.borderRadius = '8px';
            row.style.padding = '10px';
            row.style.background = '#fff7ed';
            row.textContent = msg;
            listEl.appendChild(row);
        });
    }
    document.getElementById('issuesModal').classList.add('active');
}

function printReimbursementReport() {
    const trip = getCurrentTrip();
    if (!trip) { alert('No trip selected'); return; }
    const items = (receipts[trip.id] || []).map(r => ({...r}));
    const total = items.reduce((s,r)=>s + (parseFloat(r.amount)||0), 0);
    const expensed = items.filter(r=>!!r.expensed).reduce((s,r)=>s + (parseFloat(r.amount)||0), 0);
    const unexpensed = items.filter(r=>!r.expensed);
    const unexpensedTotal = total - expensed;

    const fmtMoney = n => `$${(n||0).toFixed(2)}`;
    const safe = s => (s||'').toString();

    let body = `
      <h1 style="margin:0 0 6px 0; font-size:22px;">Reimbursement Report — ${safe(trip.name)} (${safe(trip.destination)})</h1>
      <div style="margin-bottom:16px; color:#444; font-size:13px;">${safe(trip.startDate)} to ${safe(trip.endDate)}</div>
      <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin: 10px 0 18px;">
        <div style="border:1px solid #ddd; border-radius:8px; padding:10px; display:flex; justify-content:space-between;"><span>Total</span><strong>${fmtMoney(total)}</strong></div>
        <div style="border:1px solid #ddd; border-radius:8px; padding:10px; display:flex; justify-content:space-between;"><span>Expensed</span><strong>${fmtMoney(expensed)}</strong></div>
        <div style="border:1px solid #ddd; border-radius:8px; padding:10px; display:flex; justify-content:space-between;"><span>Unexpensed</span><strong>${fmtMoney(unexpensedTotal)}</strong></div>
      </div>
    `;

    body += '<h2 style="font-size:16px; margin:12px 0 6px;">Unexpensed Items</h2>';
    if (unexpensed.length === 0) {
        body += '<p>All items are marked expensed.</p>';
    } else {
        body += '<table style="width:100%; border-collapse:collapse; margin-bottom:8px;">';
        body += '<thead><tr>'+
                  '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Date</th>'+
                  '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Vendor</th>'+
                  '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Category</th>'+
                  '<th style="text-align:right; padding:6px; border-bottom:1px solid #ddd;">Amount</th>'+
                  '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Note</th>'+
                '</tr></thead><tbody>';
        unexpensed.forEach(r => {
            body += '<tr>'+
                `<td style=\"padding:6px; border-bottom:1px solid #eee;\">${safe(r.date||'')}</td>`+
                `<td style=\"padding:6px; border-bottom:1px solid #eee;\">${safe(r.vendor||'')}</td>`+
                `<td style=\"padding:6px; border-bottom:1px solid #eee;\">${safe(r.category||'')}</td>`+
                `<td style=\"padding:6px; border-bottom:1px solid #eee; text-align:right;\">${fmtMoney(parseFloat(r.amount)||0)}</td>`+
                `<td style=\"padding:6px; border-bottom:1px solid #eee;\">${safe(r.note||'')}</td>`+
              '</tr>';
        });
        body += '</tbody></table>';
    }

    const html = `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reimbursement Report — ${safe(trip.name)}</title>
        <style>
          body{font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin:24px; color:#111;}
          @media print {
            .no-print { display:none !important; }
            body { margin: 12mm; }
            table, th, td { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="text-align:right; margin-bottom:12px;">
          <button onclick="window.print()" style="padding:6px 10px; border:1px solid #ddd; background:#fff; cursor:pointer;">Print</button>
        </div>
        ${body}
      </body>
    </html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
}

function showElementsModal() {
    const trip = getCurrentTrip();
    if (!trip) {
        alert('Please select a trip first');
        return;
    }
    const cl = checklists[trip.id] || {};
    const reg = cl.registration || {}; const hotel = cl.hotel || {}; const flight = cl.flight || {};
    const pres = (cl.presentations || []).map((p,i)=>`${i+1}. ${p.type || 'Presentation'} — ${p.name}`).join('\n');
    const lines = [
        `Trip: ${trip.name} (${trip.destination})`,
        `Dates: ${trip.startDate} to ${trip.endDate}`,
        '',
        'Registration:',
        `- Date Purchased: ${reg.date || ''}`,
        `- Confirmation #: ${reg.conf || ''}`,
        '',
        'Hotel:',
        `- Check-in: ${hotel.start || ''}`,
        `- Check-out: ${hotel.end || ''}`,
        `- Confirmation #: ${hotel.conf || ''}`,
        '',
        'Flights:',
        `- Depart: ${flight.depart || ''}`,
        `- Return: ${flight.return || ''}`,
        `- Confirmation #: ${flight.conf || ''}`,
        '',
        'Presentations:',
        pres || '- None',
    ].join('\n');
    const ta = document.getElementById('elementsPostText');
    if (ta) ta.value = lines;
    document.getElementById('elementsModal').classList.add('active');
}

function copyElementsPost() {
    const ta = document.getElementById('elementsPostText');
    if (!ta) return;
    navigator.clipboard.writeText(ta.value || '').then(()=>{
        alert('Copied to clipboard');
    }).catch(()=>{
        ta.select();
        document.execCommand('copy');
        alert('Copied');
    });
}
let checklists = JSON.parse(localStorage.getItem('checklists')) || {}; // { [tripId]: { registration:{date,conf}, hotel:{start,end,conf}, flight:{depart,return,conf}, presentations:[] } }
let leafletMap = null;
let leafletMarker = null;
let leafletMarkers = []; // Array to hold all event location markers
let receiptsFilter = 'all';
let receiptsSearch = '';

// Initialize app
function initApp() {
    loadTrips();
    if (currentTripId) {
        selectTrip(currentTripId);
    }
    updateQuickStats();
    updateBackgroundImage();
}

function updateBackgroundImage() {
    const trip = getCurrentTrip();
    const body = document.body;
    
    console.log('updateBackgroundImage called, trip:', trip);
    
    if (!trip || !trip.destination) {
        body.style.background = '#eaf1e6';
        console.log('No trip or destination, using default sage');
        return;
    }
    
    let dest = (trip.destination || '').toLowerCase();
    
    // Airport code to city mapping for major hubs (US and International)
    const airportCityMap = {
        // US Major Hubs
        'dfw': 'dallas', 'dal': 'dallas', 'ord': 'chicago', 'mdw': 'chicago',
        'atl': 'atlanta', 'lax': 'los angeles', 'jfk': 'new york', 'ewr': 'new york', 'lga': 'new york',
        'sfo': 'san francisco', 'sea': 'seattle', 'mia': 'miami', 'bos': 'boston',
        'las': 'las vegas', 'phx': 'phoenix', 'iah': 'houston', 'hou': 'houston',
        'mco': 'orlando', 'den': 'denver', 'dtw': 'detroit', 'msp': 'minneapolis',
        'phl': 'philadelphia', 'bwi': 'baltimore', 'dca': 'washington', 'iad': 'washington',
        'slc': 'salt lake city', 'san': 'san diego', 'pdx': 'portland',
        'hnl': 'honolulu', 'anc': 'anchorage',
        // Additional US Cities
        'clt': 'charlotte', 'msy': 'new orleans', 'bna': 'nashville', 'aus': 'austin',
        'rdu': 'raleigh', 'stl': 'st. louis', 'rsw': 'fort myers', 'tpa': 'tampa',
        'bdl': 'hartford', 'cmh': 'columbus', 'cvg': 'cincinnati', 'ind': 'indianapolis',
        'mci': 'kansas city', 'mke': 'milwaukee', 'okc': 'oklahoma city', 'ont': 'ontario',
        'oak': 'oakland', 'sna': 'orange county', 'smf': 'sacramento', 'sjc': 'san jose',
        'abq': 'albuquerque', 'bur': 'burbank', 'rno': 'reno', 'tus': 'tucson',
        // Major European Hubs
        'lhr': 'london', 'lgw': 'london', 'stn': 'london', 'ltn': 'london', 'lcy': 'london',
        'cdg': 'paris', 'ory': 'paris', 'lbg': 'paris',
        'fra': 'frankfurt', 'muc': 'munich', 'txl': 'berlin', 'sxf': 'berlin',
        'ams': 'amsterdam', 'mad': 'madrid', 'bcn': 'barcelona', 'fco': 'rome', 'cia': 'rome',
        'lin': 'milan', 'mxp': 'milan', 'bgy': 'milan',
        'ath': 'athens', 'ist': 'istanbul', 'saw': 'istanbul',
        'lis': 'lisbon', 'opo': 'porto', 'vie': 'vienna', 'zrh': 'zurich',
        'cph': 'copenhagen', 'osl': 'oslo', 'arn': 'stockholm', 'hel': 'helsinki',
        'dub': 'dublin', 'bru': 'brussels', 'prg': 'prague', 'bud': 'budapest',
        'waw': 'warsaw', 'svo': 'moscow', 'dme': 'moscow',
        // Major Asian/Pacific Hubs
        'hkg': 'hong kong', 'nrt': 'tokyo', 'hnd': 'tokyo',
        'sin': 'singapore', 'icn': 'seoul', 'bkk': 'bangkok', 'dmk': 'bangkok',
        'pek': 'beijing', 'pvg': 'shanghai', 'sha': 'shanghai',
        'can': 'guangzhou', 'szx': 'shenzhen', 'ctu': 'chengdu',
        'del': 'delhi', 'bom': 'mumbai', 'blr': 'bangalore', 'maa': 'chennai',
        'kul': 'kuala lumpur', 'cgk': 'jakarta', 'mnl': 'manila',
        'syd': 'sydney', 'mel': 'melbourne', 'bne': 'brisbane', 'akl': 'auckland',
        // Middle East Hubs
        'dxb': 'dubai', 'auh': 'abu dhabi', 'doh': 'doha', 'kwr': 'kuwait',
        'jed': 'jeddah', 'ruh': 'riyadh', 'bah': 'bahrain', 'cai': 'cairo',
        'tlv': 'tel aviv',
        // Latin America Hubs
        'mex': 'mexico city', 'gru': 'sao paulo', 'gig': 'rio de janeiro',
        'bog': 'bogota', 'lim': 'lima', 'scl': 'santiago', 'eze': 'buenos aires',
        'aep': 'buenos aires', 'gua': 'guatemala city', 'pty': 'panama city',
        'cun': 'cancun', 'sjo': 'san jose',
        // African Hubs
        'jnb': 'johannesburg', 'cpt': 'cape town', 'nbo': 'nairobi',
        'add': 'addis ababa', 'lag': 'lagos', 'acc': 'accra', 'dkr': 'dakar',
        // Caribbean
        'nas': 'nassau', 'mbj': 'montego bay', 'sju': 'san juan', 'puj': 'punta cana'
    };
    
    // Try to extract airport code from flight events first
    const flightEvents = trip.events ? trip.events.filter(e => e.type === 'flight') : [];
    if (flightEvents.length > 0) {
        // Look for arrival flight (usually has "to" in title or destination airport)
        const arrivalFlight = flightEvents.find(f => 
            f.title && (f.title.toLowerCase().includes(' to ') || f.title.toLowerCase().includes('arrival'))
        ) || flightEvents[flightEvents.length - 1]; // Use last flight as fallback
        
        // Try to extract airport code from location, title, or description
        const searchText = `${arrivalFlight.location || ''} ${arrivalFlight.title || ''} ${arrivalFlight.description || ''}`.toLowerCase();
        
        // Look for 3-letter airport codes (e.g., DFW, LAX, JFK)
        const airportCodeMatch = searchText.match(/\b([a-z]{3})\b/g);
        if (airportCodeMatch) {
            // Check if any matched code is in our airport map
            for (const code of airportCodeMatch) {
                if (airportCityMap[code]) {
                    dest = code;
                    console.log(`✈️ Extracted airport code ${code.toUpperCase()} from flight event`);
                    break;
                }
            }
        }
    }
    
    // Check if destination contains an airport code
    let cityKey = null;
    for (const [code, city] of Object.entries(airportCityMap)) {
        if (dest.includes(code)) {
            cityKey = city;
            console.log(`Detected airport code ${code.toUpperCase()}, mapping to ${city}`);
            break;
        }
    }
    
    // Fallback gradients with more cities - SET IMMEDIATELY for instant feedback
    const gradients = {
        'paris': 'linear-gradient(135deg, #e8f4f8 0%, #f5e6f0 100%)',
        'rome': 'linear-gradient(135deg, #fef4e6 0%, #f9ebe0 100%)',
        'tokyo': 'linear-gradient(135deg, #ffe6f0 0%, #f0e6ff 100%)',
        'new york': 'linear-gradient(135deg, #e6f0ff 0%, #f0f0f0 100%)',
        'london': 'linear-gradient(135deg, #f0f0f0 0%, #e6e6f0 100%)',
        'dallas': 'linear-gradient(135deg, #fff4e6 0%, #ffe8d9 100%)',
        'texas': 'linear-gradient(135deg, #fff4e6 0%, #ffe8d9 100%)',
        'california': 'linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%)',
        'miami': 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)',
        'chicago': 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
        'seattle': 'linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%)',
        'boston': 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 100%)',
        'las vegas': 'linear-gradient(135deg, #fff9c4 0%, #fff59d 100%)',
        'san francisco': 'linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%)',
        'los angeles': 'linear-gradient(135deg, #ffe0b2 0%, #ffcc80 100%)',
        'washington': 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
        'atlanta': 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
        'denver': 'linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 100%)',
        'phoenix': 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
        'houston': 'linear-gradient(135deg, #fbe9e7 0%, #ffccbc 100%)',
        'orlando': 'linear-gradient(135deg, #f1f8e9 0%, #dcedc8 100%)',
        'philadelphia': 'linear-gradient(135deg, #ede7f6 0%, #d1c4e9 100%)',
        'san diego': 'linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%)',
        'portland': 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)',
        'detroit': 'linear-gradient(135deg, #eceff1 0%, #cfd8dc 100%)',
        'minneapolis': 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
        'honolulu': 'linear-gradient(135deg, #e0f2f1 0%, #b2dfdb 100%)',
        'default': 'linear-gradient(135deg, #eaf1e6 0%, #f0f5f0 100%)',
    };
    
    // Landmark images from WikiMedia Commons
    const landmarkImages = {
        // US Cities
        'dallas': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Dallas_skyline_daytime.jpg/1920px-Dallas_skyline_daytime.jpg',
        'new york': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Lady_Liberty_under_a_blue_sky_%28cropped%29.jpg/1920px-Lady_Liberty_under_a_blue_sky_%28cropped%29.jpg',
        'chicago': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Chicago_skyline%2C_viewed_from_John_Hancock_Center.jpg/1920px-Chicago_skyline%2C_viewed_from_John_Hancock_Center.jpg',
        'los angeles': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Hollywood_Sign_%28Zuschnitt%29.jpg/1920px-Hollywood_Sign_%28Zuschnitt%29.jpg',
        'san francisco': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/GoldenGateBridge-001.jpg/1920px-GoldenGateBridge-001.jpg',
        'miami': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Miami_Beach_-_South_Beach_sunset.jpg/1920px-Miami_Beach_-_South_Beach_sunset.jpg',
        'seattle': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Space_Needle002.jpg/1920px-Space_Needle002.jpg',
        'boston': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Boston_skyline_and_Longfellow_Bridge.jpg/1920px-Boston_skyline_and_Longfellow_Bridge.jpg',
        'las vegas': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Las_Vegas_Strip_by_night.jpg/1920px-Las_Vegas_Strip_by_night.jpg',
        'washington': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Washington_Monument_Panorama.jpg/1920px-Washington_Monument_Panorama.jpg',
        'atlanta': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Atlanta_Skyline_from_Buckhead.jpg/1920px-Atlanta_Skyline_from_Buckhead.jpg',
        'denver': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/DenverCP.JPG/1920px-DenverCP.JPG',
        'phoenix': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Downtown_Phoenix_Aerial_Looking_Northeast.jpg/1920px-Downtown_Phoenix_Aerial_Looking_Northeast.jpg',
        'houston': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Downtown_Houston_and_I-45.jpg/1920px-Downtown_Houston_and_I-45.jpg',
        'orlando': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Cinderella_Castle_2013_Wade.jpg/1920px-Cinderella_Castle_2013_Wade.jpg',
        'philadelphia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Philadelphia_skyline_from_south_street_bridge.jpg/1920px-Philadelphia_skyline_from_south_street_bridge.jpg',
        'san diego': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/San_Diego_Skyline_at_Dawn.jpg/1920px-San_Diego_Skyline_at_Dawn.jpg',
        'portland': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Portland_and_Mt._Hood.jpg/1920px-Portland_and_Mt._Hood.jpg',
        'honolulu': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Waikiki_beach.jpg/1920px-Waikiki_beach.jpg',
        'san antonio': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Alamo_plaza.jpg/1920px-Alamo_plaza.jpg',
        'nashville': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Nashville_skyline_2009.jpg/1920px-Nashville_skyline_2009.jpg',
        'austin': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/Austin_State_Capitol_building.jpg/1920px-Austin_State_Capitol_building.jpg',
        // Europe
        'paris': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/1920px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg',
        'london': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Clock_Tower_-_Palace_of_Westminster%2C_London_-_May_2007.jpg/1920px-Clock_Tower_-_Palace_of_Westminster%2C_London_-_May_2007.jpg',
        'rome': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Colosseo_2020.jpg/1920px-Colosseo_2020.jpg',
        'barcelona': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Sagrada_Familia_2021.jpg/1920px-Sagrada_Familia_2021.jpg',
        'amsterdam': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Amsterdam_Canals_-_July_2006.jpg/1920px-Amsterdam_Canals_-_July_2006.jpg',
        'berlin': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Brandenburger_Tor_abends.jpg/1920px-Brandenburger_Tor_abends.jpg',
        'madrid': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Palacio_Real_de_Madrid_-_02.jpg/1920px-Palacio_Real_de_Madrid_-_02.jpg',
        'vienna': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Sch%C3%B6nbrunn_Palace%2C_Vienna.jpg/1920px-Sch%C3%B6nbrunn_Palace%2C_Vienna.jpg',
        'prague': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Prague_-_Charles_Bridge.jpg/1920px-Prague_-_Charles_Bridge.jpg',
        'budapest': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Hungary-0080_-_Parliament_%287263364602%29.jpg/1920px-Hungary-0080_-_Parliament_%287263364602%29.jpg',
        'dublin': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Ha%27penny_Bridge_at_night.jpg/1920px-Ha%27penny_Bridge_at_night.jpg',
        'edinburgh': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Edinburgh_Castle_from_the_footbridge.jpg/1920px-Edinburgh_Castle_from_the_footbridge.jpg',
        'lisbon': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Bel%C3%A9m_Tower_Lisbon.jpg/1920px-Bel%C3%A9m_Tower_Lisbon.jpg',
        'athens': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/The_Parthenon_in_Athens.jpg/1920px-The_Parthenon_in_Athens.jpg',
        'istanbul': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Hagia_Sophia_Mars_2013.jpg/1920px-Hagia_Sophia_Mars_2013.jpg',
        'moscow': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Saint_Basils_cathedral.jpg/1920px-Saint_Basils_cathedral.jpg',
        'copenhagen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Amalienborg_Plads_Copenhagen.jpg/1920px-Amalienborg_Plads_Copenhagen.jpg',
        'stockholm': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Stockholm_Palace_2016.jpg/1920px-Stockholm_Palace_2016.jpg',
        'oslo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Oslo_Opera_House_seen_from_the_sea.jpg/1920px-Oslo_Opera_House_seen_from_the_sea.jpg',
        'helsinki': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Helsinki_Cathedral_in_July_2004.jpg/1920px-Helsinki_Cathedral_in_July_2004.jpg',
        'brussels': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Bruxelles_Grand-Place_Grote_Markt.jpg/1920px-Bruxelles_Grand-Place_Grote_Markt.jpg',
        'zurich': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Zurich_-_panoramio_%2823%29.jpg/1920px-Zurich_-_panoramio_%2823%29.jpg',
        'milan': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Milano_-_Duomo.jpg/1920px-Milano_-_Duomo.jpg',
        'venice': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Venice_-_Rialto_bridge.jpg/1920px-Venice_-_Rialto_bridge.jpg',
        'florence': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Florence_Duomo_from_Michelangelo_hill.jpg/1920px-Florence_Duomo_from_Michelangelo_hill.jpg',
        'munich': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Neuschwanstein_castle.jpg/1920px-Neuschwanstein_castle.jpg',
        'frankfurt': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Frankfurt_am_Main_-_R%C3%B6mer_bei_Nacht.jpg/1920px-Frankfurt_am_Main_-_R%C3%B6mer_bei_Nacht.jpg',
        // Middle East
        'dubai': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Burj_Khalifa.jpg/1920px-Burj_Khalifa.jpg',
        'abu dhabi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Sheikh_Zayed_Grand_Mosque_Abu_Dhabi.jpg/1920px-Sheikh_Zayed_Grand_Mosque_Abu_Dhabi.jpg',
        'doha': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Doha_Skyline_in_the_Morning.jpg/1920px-Doha_Skyline_in_the_Morning.jpg',
        'tel aviv': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/Tel_Aviv_Beach.jpg/1920px-Tel_Aviv_Beach.jpg',
        'cairo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/All_Gizah_Pyramids.jpg/1920px-All_Gizah_Pyramids.jpg',
        'jerusalem': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Jerusalem_Western_Wall_BW_1.JPG/1920px-Jerusalem_Western_Wall_BW_1.JPG',
        'beirut': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Pigeon_Rocks_Beirut_Lebanon.jpg/1920px-Pigeon_Rocks_Beirut_Lebanon.jpg',
        // Asia
        'tokyo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Tokyo_Tower_2023.jpg/1920px-Tokyo_Tower_2023.jpg',
        'hong kong': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Hong_Kong_Night_Skyline.jpg/1920px-Hong_Kong_Night_Skyline.jpg',
        'singapore': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Marina_Bay_Sands_in_the_evening.jpg/1920px-Marina_Bay_Sands_in_the_evening.jpg',
        'beijing': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Temple_of_Heaven.jpg/1920px-Temple_of_Heaven.jpg',
        'shanghai': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Shanghai_-_Bund_at_night.jpg/1920px-Shanghai_-_Bund_at_night.jpg',
        'bangkok': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Wat_Arun_Bangkok_Thailand.jpg/1920px-Wat_Arun_Bangkok_Thailand.jpg',
        'seoul': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Seoul_City_view_from_63_Building.jpg/1920px-Seoul_City_view_from_63_Building.jpg',
        'taipei': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Taipei_101_from_afar.jpg/1920px-Taipei_101_from_afar.jpg',
        'mumbai': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/Gateway_of_India.jpg/1920px-Gateway_of_India.jpg',
        'delhi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Red_Fort_in_Delhi_03-2016_img3.jpg/1920px-Red_Fort_in_Delhi_03-2016_img3.jpg',
        'bangalore': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Bangalore_Palace.jpg/1920px-Bangalore_Palace.jpg',
        'kuala lumpur': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Petronas_Panorama_II.jpg/1920px-Petronas_Panorama_II.jpg',
        'jakarta': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/National_Monument_in_Jakarta.jpg/1920px-National_Monument_in_Jakarta.jpg',
        'manila': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Fort_Santiago_Gate.jpg/1920px-Fort_Santiago_Gate.jpg',
        // Oceania
        'sydney': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Sydney_Opera_House_-_Dec_2008.jpg/1920px-Sydney_Opera_House_-_Dec_2008.jpg',
        'melbourne': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Flinders_Street_Station_Melbourne.jpg/1920px-Flinders_Street_Station_Melbourne.jpg',
        'brisbane': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Story_Bridge_Brisbane.jpg/1920px-Story_Bridge_Brisbane.jpg',
        'auckland': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Sky_Tower_Auckland.jpg/1920px-Sky_Tower_Auckland.jpg',
        // Latin America
        'rio de janeiro': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Cidade_Maravilhosa.jpg/1920px-Cidade_Maravilhosa.jpg',
        'sao paulo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f8/S%C3%A3o_Paulo_Montagem.png/1920px-S%C3%A3o_Paulo_Montagem.png',
        'buenos aires': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Obelisco_-_Buenos_Aires.jpg/1920px-Obelisco_-_Buenos_Aires.jpg',
        'mexico city': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Palacio_de_Bellas_Artes.jpg/1920px-Palacio_de_Bellas_Artes.jpg',
        'bogota': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Monserrate-Bogota.jpg/1920px-Monserrate-Bogota.jpg',
        'lima': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Lima_Cathedral.jpg/1920px-Lima_Cathedral.jpg',
        'santiago': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Santiago_de_Chile.jpg/1920px-Santiago_de_Chile.jpg',
        'cancun': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Cancun_beach_panorama.jpg/1920px-Cancun_beach_panorama.jpg',
        // Africa
        'johannesburg': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Johannesburg_-_Skyline.jpg/1920px-Johannesburg_-_Skyline.jpg',
        'cape town': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Table_Mountain_from_Blouberg.jpg/1920px-Table_Mountain_from_Blouberg.jpg',
        'nairobi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/KICC_Nairobi.jpg/1920px-KICC_Nairobi.jpg',
        'marrakech': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Koutoubia_Marrakech.jpg/1920px-Koutoubia_Marrakech.jpg',
        'casablanca': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Hassan_II_Mosque.jpg/1920px-Hassan_II_Mosque.jpg'
    };
    
    // Find the appropriate key (check cityKey from airport code first, then destination)
    const matchKey = cityKey || Object.keys(landmarkImages).find(k => dest.includes(k));
    const gradientKey = cityKey || Object.keys(gradients).find(k => dest.includes(k));
    const gradient = gradients[gradientKey] || gradients['default'];
    
    // Set gradient immediately for instant feedback
    body.style.background = gradient;
    console.log('Background gradient set for:', trip.destination, 'key:', gradientKey || 'default');
    
    // Create beautiful animated gradient backgrounds (clean, no patterns)
    const animatedBackgrounds = {
        'dallas': {
            gradient: 'linear-gradient(-45deg, #FFF5E1, #FFE4C4, #FFDAB9, #FFE5CC)',
            icon: '🤠'
        },
        'new york': {
            gradient: 'linear-gradient(-45deg, #E6F3FF, #CCE5FF, #B3D9FF, #99CCFF)',
            icon: '🗽'
        },
        'paris': {
            gradient: 'linear-gradient(-45deg, #FFF0F5, #FFE4E9, #FFD6E0, #FFC9D6)',
            icon: '🗼'
        },
        'london': {
            gradient: 'linear-gradient(-45deg, #F0F0F5, #E6E6F0, #D9D9EB, #CCCCFF)',
            icon: '🎡'
        },
        'tokyo': {
            gradient: 'linear-gradient(-45deg, #FFE6F0, #FFD6E8, #FFC6E0, #FFB6D9)',
            icon: '🗻'
        },
        'rome': {
            gradient: 'linear-gradient(-45deg, #FFF8DC, #FFEFD5, #FFE4B5, #FFDAB9)',
            icon: '🏛️'
        },
        'chicago': {
            gradient: 'linear-gradient(-45deg, #E0F2F7, #B3E5FC, #81D4FA, #4FC3F7)',
            icon: '🏙️'
        },
        'los angeles': {
            gradient: 'linear-gradient(-45deg, #FFF9E6, #FFF4CC, #FFECB3, #FFE082)',
            icon: '🌴'
        },
        'miami': {
            gradient: 'linear-gradient(-45deg, #E0F7FA, #B2EBF2, #80DEEA, #4DD0E1)',
            icon: '🏖️'
        },
        'san francisco': {
            gradient: 'linear-gradient(-45deg, #FFF3E0, #FFE0B2, #FFCC80, #FFB74D)',
            icon: '🌉'
        },
        'las vegas': {
            gradient: 'linear-gradient(-45deg, #FFF9C4, #FFF59D, #FFF176, #FFEE58)',
            icon: '🎰'
        },
        'orlando': {
            gradient: 'linear-gradient(-45deg, #E8F5E9, #C8E6C9, #A5D6A7, #81C784)',
            icon: '🏰'
        },
        'boston': {
            gradient: 'linear-gradient(-45deg, #E3F2FD, #BBDEFB, #90CAF9, #64B5F6)',
            icon: '⚾'
        },
        'seattle': {
            gradient: 'linear-gradient(-45deg, #E0F2F1, #B2DFDB, #80CBC4, #4DB6AC)',
            icon: '☕'
        },
        'detroit': {
            gradient: 'linear-gradient(-45deg, #E3F2FD, #BBDEFB, #90CAF9, #64B5F6)',
            icon: '🚗'
        },
        'barcelona': {
            gradient: 'linear-gradient(-45deg, #FFF3E0, #FFE0B2, #FFCC80, #FFB74D)',
            icon: '🏖️'
        },
        'dubai': {
            gradient: 'linear-gradient(-45deg, #FFF8E1, #FFECB3, #FFE082, #FFD54F)',
            icon: '🏙️'
        }
    };
    
    const bgConfig = animatedBackgrounds[matchKey] || {
        gradient: gradient,
        icon: '✈️'
    };
    
    // Apply smooth animated gradient background
    body.style.backgroundImage = bgConfig.gradient;
    body.style.backgroundSize = '400% 400%';
    body.style.backgroundAttachment = 'fixed';
    body.style.animation = 'gradientShift 15s ease infinite';
    
    // Add floating icons
    createFloatingIcons(matchKey);
    
    console.log(`✨ Applied smooth gradient for: ${matchKey} ${bgConfig.icon}`);
}

function createFloatingIcons(city) {
    // Clear ALL existing icons (both floating and static)
    document.querySelectorAll('.floating-icon').forEach(icon => icon.remove());
    document.querySelectorAll('.static-icon').forEach(icon => icon.remove());
    
    // City-specific icon themes
    // To add a new city: add a new line with city name and 5 relevant emoji icons
    const cityIcons = {
        'dallas': ['🤠', '🐴', '🌵', '⭐', '🏈'],
        'new york': ['🗽', '🍎', '🚕', '🏙️', '🎭'],
        'paris': ['🗼', '🥐', '🎨', '🍷', '🌹'],
        'london': ['☕', '🎡', '👑', '🚌', '☔'],
        'tokyo': ['🗻', '🍣', '🎌', '🌸', '🏯'],
        'rome': ['🏛️', '🍝', '⛲', '🍕', '🏺'],
        'chicago': ['🏙️', '🌭', '🎷', '🏈', '🌊'],
        'los angeles': ['🌴', '🎬', '🌊', '☀️', '🎸'],
        'miami': ['🏖️', '🌴', '☀️', '🌊', '🍹'],
        'san francisco': ['🌉', '🚃', '🦭', '🌁', '🍷'],
        'las vegas': ['🎰', '🎲', '💎', '🎪', '✨'],
        'orlando': ['🏰', '🎢', '🐭', '🎆', '🎠'],
        'boston': ['⚾', '🦞', '🍀', '🏛️', '⛵'],
        'seattle': ['☕', '🌲', '🐟', '🌧️', '🗻'],
        'detroit': ['🚗', '🎵', '🎤', '🦁', '🌊'],  // Motor City + Motown + Lions + Great Lakes
        'barcelona': ['🏖️', '🎨', '⚽', '🍷', '🏛️'],
        'dubai': ['🏙️', '🐪', '🌴', '💎', '✨']
    };
    
    const icons = cityIcons[city] || ['✈️', '🌍', '🗺️', '🎒', '📸'];
    
    // Create more concentrated icons with moderate spacing
    const rows = 5;
    const cols = 7;
    const padding = 100; // Space from edges
    
    // Calculate spacing with MINIMUM 180px between icons (more concentrated)
    const gridWidth = window.innerWidth - (padding * 2);
    const gridHeight = window.innerHeight - (padding * 2);
    const spacingX = Math.max(180, gridWidth / (cols - 1));
    const spacingY = Math.max(180, gridHeight / (rows - 1));
    
    // Only create if screen is large enough
    if (gridWidth > 600 && gridHeight > 400) {
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const icon = document.createElement('div');
                icon.className = 'static-icon';
                icon.textContent = icons[Math.floor(Math.random() * icons.length)];
                
                // Evenly spaced grid positions with huge gaps
                const x = Math.round(padding + (col * spacingX));
                const y = Math.round(padding + (row * spacingY));
                
                icon.style.left = x + 'px';
                icon.style.top = y + 'px';
                
                // Icon size
                icon.style.fontSize = '2rem';
                
                document.body.appendChild(icon);
            }
        }
    }
}

function printItinerary() {
    const trip = getCurrentTrip();
    if (!trip) {
        alert('No trip selected');
        return;
    }
    const events = Array.isArray(trip.events) ? [...trip.events] : [];
    // Group by date and sort
    const byDate = {};
    events.forEach(e => {
        if (!e || !e.date) return;
        if (!byDate[e.date]) byDate[e.date] = [];
        byDate[e.date].push(e);
    });
    const days = Object.keys(byDate).sort();
    days.forEach(d => byDate[d].sort((a,b) => (a.startTime||'').localeCompare(b.startTime||'')));

    const safe = s => (s || '').toString();
    const formatTitle = () => `${safe(trip.name)} — ${safe(trip.destination)}`;

    let body = `
        <h1 style="margin:0 0 6px 0; font-size:22px;">${formatTitle()}</h1>
        <div style="margin-bottom:16px; color:#444; font-size:13px;">
            ${safe(trip.startDate)} to ${safe(trip.endDate)}
        </div>
    `;
    if (days.length === 0) {
        body += `<p>No events yet.</p>`;
    } else {
        days.forEach(day => {
            const pretty = new Date(day).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
            body += `<h2 style=\"font-size:16px; margin:18px 0 8px; border-bottom:1px solid #ddd; padding-bottom:4px;\">${pretty}</h2>`;
            body += '<table style="width:100%; border-collapse:collapse; margin-bottom:8px;">';
            body += '<thead><tr>'+
                    '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd; width:110px;">Time</th>'+
                    '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Title</th>'+
                    '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Location</th>'+
                    '<th style="text-align:left; padding:6px; border-bottom:1px solid #ddd;">Notes</th>'+
                '</tr></thead><tbody>';
            byDate[day].forEach(ev => {
                const time = `${safe(ev.startTime||'')}${ev.endTime? ' - '+safe(ev.endTime): ''}`;
                body += '<tr>'+
                        `<td style=\"padding:6px; border-bottom:1px solid #eee; color:#333;\">${time}</td>`+
                        `<td style=\"padding:6px; border-bottom:1px solid #eee; font-weight:600;\">${safe(ev.title)}</td>`+
                        `<td style=\"padding:6px; border-bottom:1px solid #eee;\">${safe(ev.location||'')}</td>`+
                        `<td style=\"padding:6px; border-bottom:1px solid #eee; white-space:pre-wrap;\">${safe(ev.description||'')}</td>`+
                    '</tr>';
            });
            body += '</tbody></table>';
        });
    }

    const html = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Itinerary - ${formatTitle()}</title>
      <style>
        body{font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin:24px; color:#111;} 
        @media print { 
          .no-print { display:none !important; }
          body { margin: 12mm; }
          table, th, td { page-break-inside: avoid; }
          h2 { page-break-after: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align:right; margin-bottom:12px;">
        <button onclick="window.print()" style="padding:6px 10px; border:1px solid #ddd; background:#fff; cursor:pointer;">Print</button>
      </div>
      ${body}
    </body>
    </html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    // Slight delay to ensure content renders before printing if user clicks system print
    setTimeout(() => { try { win.focus(); } catch(e){} }, 100);
}
// Trip Management
function loadTrips() {
    const tripsList = document.getElementById('tripsList');
    const archivedList = document.getElementById('archivedTripsList');
    tripsList.innerHTML = '';
    if (archivedList) archivedList.innerHTML = '';

    const active = trips.filter(t => !t.archived);
    const archived = trips.filter(t => t.archived);

    active.forEach(trip => {
        const tripItem = document.createElement('div');
        tripItem.className = `trip-item ${trip.id === currentTripId ? 'active' : ''}`;
        tripItem.onclick = () => selectTrip(trip.id);
        const dates = `${formatDate(new Date(trip.startDate))} - ${formatDate(new Date(trip.endDate))}`;
        tripItem.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <div>
                    <div style="font-weight: 600;">${trip.name}</div>
                    <div class="trip-dates">${trip.destination}</div>
                    <div class="trip-dates">${dates}</div>
                </div>
                <div style="display:flex; gap:4px;">
                    <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.85em;" onclick="event.stopPropagation(); editTrip('${trip.id}')">✏️ Edit</button>
                    <button class="btn btn-secondary" style="padding:4px 8px;" onclick="event.stopPropagation(); archiveTrip('${trip.id}')">Archive</button>
                </div>
            </div>
        `;
        tripsList.appendChild(tripItem);
    });

    if (archivedList) {
        if (archived.length === 0) {
            archivedList.innerHTML = '<p style="color:#64748b;">No archived trips</p>';
        } else {
            archived.forEach(trip => {
                const tripItem = document.createElement('div');
                tripItem.className = 'trip-item';
                tripItem.onclick = () => selectTrip(trip.id);
                const dates = `${formatDate(new Date(trip.startDate))} - ${formatDate(new Date(trip.endDate))}`;
                tripItem.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <div>
                            <div style="font-weight: 600;">${trip.name}</div>
                            <div class="trip-dates">${trip.destination}</div>
                            <div class="trip-dates">${dates}</div>
                        </div>
                        <button class="btn btn-primary" style="padding:4px 8px;" onclick="event.stopPropagation(); unarchiveTrip('${trip.id}')">Unarchive</button>
                    </div>
                `;
                archivedList.appendChild(tripItem);
            });
        }
    }
}

function createNewTrip() {
    const name = document.getElementById('newTripName').value;
    const destination = document.getElementById('newTripDestination').value;
    const startDate = document.getElementById('newTripStart').value;
    const endDate = document.getElementById('newTripEnd').value;
    
    if (!name || !destination || !startDate || !endDate) {
        alert('Please fill all fields');
        return;
    }
    
    const trip = {
        id: Date.now().toString(),
        name,
        destination,
        startDate,
        endDate,
        events: [],
        created: new Date().toISOString(),
        archived: false
    };
    
    trips.push(trip);
    localStorage.setItem('trips', JSON.stringify(trips));
    
    // Initialize empty storage for this trip
    packingItems[trip.id] = [];
    budgetItems[trip.id] = [];
    receipts[trip.id] = [];
    documents[trip.id] = [];
    checklists[trip.id] = { registration:{date:'',conf:''}, hotel:{start:'',end:'',conf:''}, flight:{depart:'',return:'',conf:''}, presentations:[] };
    conferenceProgram[trip.id] = null;
    agendas[trip.id] = { url: '', text: '' };
    checklists[trip.id] = { registration:{date:'',conf:''}, hotel:{start:'',end:'',conf:''}, flight:{depart:'',return:'',conf:''}, presentations:[] };
    
    localStorage.setItem('packingItems', JSON.stringify(packingItems));
    localStorage.setItem('budgetItems', JSON.stringify(budgetItems));
    localStorage.setItem('receipts', JSON.stringify(receipts));
    localStorage.setItem('documents', JSON.stringify(documents));
    localStorage.setItem('checklists', JSON.stringify(checklists));
    localStorage.setItem('conferenceProgram', JSON.stringify(conferenceProgram));
    localStorage.setItem('agendas', JSON.stringify(agendas));
    localStorage.setItem('checklists', JSON.stringify(checklists));
    
    loadTrips();
    selectTrip(trip.id);
    closeModal('newTripModal');
    
    // Clear form
    document.getElementById('newTripName').value = '';
    document.getElementById('newTripDestination').value = '';
    document.getElementById('newTripStart').value = '';
    document.getElementById('newTripEnd').value = '';
}

function selectTrip(tripId) {
    currentTripId = tripId;
    localStorage.setItem('currentTripId', tripId);
    loadTrips();
    displayItinerary();
    updateQuickStats();
    loadPackingList();
    migrateBudgetToReceiptsIfNeeded(tripId);
    loadReceipts();
    loadChecklist();
    updateBackgroundImage();
}

function getCurrentTrip() {
    return trips.find(t => t.id === currentTripId);
}

function editTrip(tripId) {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    
    // Populate edit form
    document.getElementById('editTripId').value = trip.id;
    document.getElementById('editTripName').value = trip.name;
    document.getElementById('editTripDestination').value = trip.destination;
    document.getElementById('editTripStart').value = trip.startDate;
    document.getElementById('editTripEnd').value = trip.endDate;
    
    // Open modal
    document.getElementById('editTripModal').classList.add('active');
}

function saveEditTrip() {
    const tripId = document.getElementById('editTripId').value;
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    
    trip.name = document.getElementById('editTripName').value;
    trip.destination = document.getElementById('editTripDestination').value;
    trip.startDate = document.getElementById('editTripStart').value;
    trip.endDate = document.getElementById('editTripEnd').value;
    
    localStorage.setItem('trips', JSON.stringify(trips));
    
    loadTrips();
    displayItinerary();
    updateQuickStats();
    updateBackgroundImage();
    loadWeather(); // Reload weather with new destination
    
    closeModal('editTripModal');
}

function archiveTrip(tripId) {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    trip.archived = true;
    localStorage.setItem('trips', JSON.stringify(trips));
    loadTrips();
}

function unarchiveTrip(tripId) {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    trip.archived = false;
    localStorage.setItem('trips', JSON.stringify(trips));
    loadTrips();
}

// Event Management
function addEvent() {
    const trip = getCurrentTrip();
    if (!trip) {
        alert('Please select a trip first');
        return;
    }
    
    const event = {
        id: Date.now().toString(),
        type: document.getElementById('eventType').value,
        title: document.getElementById('eventTitle').value,
        date: document.getElementById('eventDate').value,
        startTime: document.getElementById('eventStartTime').value,
        endTime: document.getElementById('eventEndTime').value,
        location: document.getElementById('eventLocation').value,
        description: document.getElementById('eventDescription').value
    };
    
    trip.events.push(event);
    localStorage.setItem('trips', JSON.stringify(trips));
    
    displayItinerary();
    updateBackgroundImage(); // Update background if flight info changes
    closeModal('addEventModal');
    
    // Clear form
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventStartTime').value = '';
    document.getElementById('eventEndTime').value = '';
    document.getElementById('eventLocation').value = '';
    document.getElementById('eventDescription').value = '';
}

function displayItinerary() {
    const trip = getCurrentTrip();
    const content = document.getElementById('itineraryContent');
    
    if (!trip) {
        content.innerHTML = `
            <div style="text-align: center; padding: 60px; color: #64748b;">
                <h3>No trip selected</h3>
                <p>Create a new trip or select one from the sidebar to get started</p>
            </div>
        `;
        return;
    }
    
    if (!trip.events || trip.events.length === 0) {
        content.innerHTML = `
            <div style="text-align: center; padding: 60px; color: #64748b;">
                <h3>No events yet</h3>
                <p>Add your first event to start planning your trip</p>
            </div>
        `;
        return;
    }
    
    // Optional agenda summary panel
    const agenda = agendas[trip.id];
    let agendaPanel = '';
    if (agenda && (agenda.url || agenda.text)) {
        const preview = (agenda.text || '').slice(0, 200);
        const more = (agenda.text || '').length > 200 ? '…' : '';
        const urlHtml = agenda.url ? `<a href="${agenda.url}" target="_blank" rel="noopener">Open agenda URL</a>` : '';
        agendaPanel = `
            <div style="background:#f8fafc; border:1px solid var(--border); padding:12px; border-radius:8px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                    <strong>Conference Agenda</strong>
                    <div style="display:flex; gap:8px;">
                        ${urlHtml}
                        <button class="btn btn-secondary" onclick="showAgendaModal()">Edit</button>
                    </div>
                </div>
                ${preview ? `<div style=\"color:#475569; margin-top:8px; white-space:pre-wrap;\">${preview}${more}</div>` : ''}
            </div>
        `;
    }

    // Group events by day
    const eventsByDay = {};
    trip.events.forEach(event => {
        if (!eventsByDay[event.date]) {
            eventsByDay[event.date] = [];
        }
        eventsByDay[event.date].push(event);
    });
    
    // Sort days
    const sortedDays = Object.keys(eventsByDay).sort();
    
    content.innerHTML = (agendaPanel + checklistPanel) || '';
    sortedDays.forEach(day => {
        const daySection = document.createElement('div');
        daySection.className = 'day-section';
        
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.innerHTML = `
            <div>
                <h3>${formatDate(new Date(day))}</h3>
            </div>
            <div>${eventsByDay[day].length} event(s)</div>
        `;
        daySection.appendChild(dayHeader);
        
        // Sort events by start time
        eventsByDay[day].sort((a, b) => {
            return (a.startTime || '').localeCompare(b.startTime || '');
        });
        
        eventsByDay[day].forEach(event => {
            const eventCard = document.createElement('div');
            eventCard.className = `event-card ${event.type}-event`;
            
            const badgeClass = event.type === 'conference' ? 'badge-conference' : 
                               event.type === 'flight' ? 'badge-flight' : 'badge-personal';
            
            eventCard.innerHTML = `
                <span class="event-badge ${badgeClass}">${event.type}</span>
                <div class="event-time">${event.startTime || ''} ${event.endTime ? '- ' + event.endTime : ''}</div>
                <div class="event-title">${event.title}</div>
                <div class="event-location">📍 ${event.location || 'No location'}</div>
                ${event.description ? `<div class="event-description">${event.description}</div>` : ''}
            `;
            daySection.appendChild(eventCard);
        });
        
        content.appendChild(daySection);
    });
}

// Packing List
function loadPackingList() {
    const trip = getCurrentTrip();
    const list = document.getElementById('packingList');
    
    if (!trip || !packingItems[trip.id]) {
        list.innerHTML = '<p style="color: #64748b; text-align: center; padding: 20px;">No items yet</p>';
        return;
    }
    
    list.innerHTML = '';
    packingItems[trip.id].forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `packing-item ${item.checked ? 'checked' : ''}`;
        itemDiv.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; flex:1;">
                <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="togglePackingItem(${index})">
                <label>${item.name}</label>
            </div>
            <div style="display:flex; gap:6px;">
                <button class="btn btn-secondary" style="padding:4px 8px;" onclick="editPackingItem(${index})">Edit</button>
                <button class="btn btn-danger" style="padding:4px 8px;" onclick="deletePackingItem(${index})">Delete</button>
            </div>
        `;
        list.appendChild(itemDiv);
    });
}

function addPackingItem() {
    const trip = getCurrentTrip();
    if (!trip) {
        alert('Please select a trip first');
        return;
    }
    
    const itemName = document.getElementById('newPackingItem').value.trim();
    if (!itemName) return;
    
    if (!packingItems[trip.id]) {
        packingItems[trip.id] = [];
    }
    
    packingItems[trip.id].push({
        name: itemName,
        checked: false
    });
    
    localStorage.setItem('packingItems', JSON.stringify(packingItems));
    loadPackingList();
    
    document.getElementById('newPackingItem').value = '';
}

function togglePackingItem(index) {
    const trip = getCurrentTrip();
    if (!trip) return;
    
    packingItems[trip.id][index].checked = !packingItems[trip.id][index].checked;
    localStorage.setItem('packingItems', JSON.stringify(packingItems));
    loadPackingList();
}

function editPackingItem(index) {
    const trip = getCurrentTrip();
    if (!trip) return;
    const current = packingItems[trip.id][index];
    const newName = prompt('Edit item name', current.name || '');
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    packingItems[trip.id][index].name = trimmed;
    localStorage.setItem('packingItems', JSON.stringify(packingItems));
    loadPackingList();
}

function deletePackingItem(index) {
    const trip = getCurrentTrip();
    if (!trip) return;
    packingItems[trip.id].splice(index, 1);
    localStorage.setItem('packingItems', JSON.stringify(packingItems));
    loadPackingList();
}

// Budget Tracker
function loadReceipts() {
    const trip = getCurrentTrip();
    const list = document.getElementById('receiptsList');
    const totalEl = document.getElementById('receiptsTotal');
    const totalUnexpensedEl = document.getElementById('receiptsTotalUnexpensed');
    const totalExpensedEl = document.getElementById('receiptsTotalExpensed');
    
    if (!trip) {
        if (list) list.innerHTML = '<p style="color: #64748b; text-align: center; padding: 20px;">No receipts yet</p>';
        if (totalEl) totalEl.textContent = '$0.00';
        if (totalUnexpensedEl) totalUnexpensedEl.textContent = '$0.00';
        if (totalExpensedEl) totalExpensedEl.textContent = '$0.00';
        return;
    }
    
    if (!receipts[trip.id] || receipts[trip.id].length === 0) {
        list.innerHTML = '<p style="color: #64748b; text-align: center; padding: 20px;">No receipts yet</p>';
        totalEl.textContent = '$0.00';
        totalUnexpensedEl.textContent = '$0.00';
        totalExpensedEl.textContent = '$0.00';
        return;
    }
    
    list.innerHTML = '';
    let total = 0;
    let expensedTotal = 0;
    
    receipts[trip.id]
      .filter(item => {
        if (receiptsFilter === 'expensed' && !item.expensed) return false;
        if (receiptsFilter === 'unexpensed' && item.expensed) return false;
        if (receiptsSearch && !String(item.vendor||'').toLowerCase().includes(receiptsSearch)) return false;
        return true;
      })
      .forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'budget-item';
        const dateStr = item.date ? (typeof item.date === 'string' ? item.date : new Date(item.date).toISOString().split('T')[0]) : '';
        itemDiv.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; justify-content: space-between; width:100%">
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" ${item.expensed ? 'checked' : ''} onchange="toggleReceiptExpensed(${index})" title="Mark as expensed">
                    <div>
                        <div style="font-weight:600; display:flex; align-items:center; gap:8px;">
                          <span>${item.vendor}</span>
                          <small style=\"color:#64748b;\">(${item.category})</small>
                          <span style=\"font-size:12px; padding:2px 6px; border-radius:999px; border:1px solid var(--border); color:${item.expensed ? '#166534' : '#7c2d12'}; background:${item.expensed ? '#ecfdf5' : '#fff7ed'};\">${item.expensed ? 'Expensed' : 'Unexpensed'}</span>
                        </div>
                        <div style="font-size: 0.85em; color:#64748b;">${dateStr}${item.note ? ' · ' + item.note : ''}</div>
                        ${item.category === 'Food' ? `<div style=\"font-size: 0.85em; color:#7c2d12;\">${(item.attendees && item.attendees.trim()) ? 'Attendees: ' + item.attendees : 'Attendees: —'}${(item.purpose && item.purpose.trim()) ? ' · Purpose: ' + item.purpose : ' · Purpose: —'}</div>` : ''}
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <div style="font-weight:600;">$${parseFloat(item.amount).toFixed(2)}</div>
                  <button class="btn btn-secondary" style="padding:4px 8px;" onclick="editReceiptItem(${index})">Edit</button>
                  <button class="btn btn-danger" style="padding:4px 8px;" onclick="deleteReceiptItem(${index})">Delete</button>
                </div>
            </div>
        `;
        list.appendChild(itemDiv);
        const amt = parseFloat(item.amount) || 0;
        total += amt;
        if (item.expensed) {
            expensedTotal += amt;
        }
    });
    
    totalEl.textContent = `$${total.toFixed(2)}`;
    totalExpensedEl.textContent = `$${expensedTotal.toFixed(2)}`;
    totalUnexpensedEl.textContent = `$${(total - expensedTotal).toFixed(2)}`;
}

function addReceiptItem() {
    const trip = getCurrentTrip();
    if (!trip) {
        alert('Please select a trip first');
        return;
    }
    
    const vendor = document.getElementById('receiptVendor').value.trim();
    const amountStr = document.getElementById('receiptAmount').value;
    const category = document.getElementById('receiptCategory').value;
    const dateInput = document.getElementById('receiptDate').value;
    const note = document.getElementById('receiptNote').value.trim();
    const attendees = (document.getElementById('receiptAttendees')?.value || '').trim();
    const purpose = (document.getElementById('receiptPurpose')?.value || '').trim();
    const expensedAtAdd = !!document.getElementById('receiptExpensedAtAdd')?.checked;
    
    if (!vendor || !amountStr) {
        alert('Please fill in vendor and amount');
        return;
    }
    
    if (!receipts[trip.id]) {
        receipts[trip.id] = [];
    }
    
    const date = dateInput && dateInput.length > 0 ? dateInput : new Date().toISOString().split('T')[0];
    receipts[trip.id].push({
        vendor,
        amount: parseFloat(amountStr),
        category,
        date,
        note,
        attendees,
        purpose,
        expensed: expensedAtAdd
    });
    
    localStorage.setItem('receipts', JSON.stringify(receipts));
    loadReceipts();
    
    document.getElementById('receiptVendor').value = '';
    document.getElementById('receiptAmount').value = '';
    document.getElementById('receiptDate').value = '';
    document.getElementById('receiptNote').value = '';
    const attEl = document.getElementById('receiptAttendees'); if (attEl) attEl.value = '';
    const purpEl = document.getElementById('receiptPurpose'); if (purpEl) purpEl.value = '';
    const expBox = document.getElementById('receiptExpensedAtAdd');
    if (expBox) expBox.checked = false;
}

// Checklist
function loadChecklist() {
    const trip = getCurrentTrip();
    if (!trip) return;
    const data = checklists[trip.id] || { registration:{}, hotel:{}, flight:{}, presentations:[] };
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('chkRegistrationDate', data.registration?.date);
    set('chkRegistrationConf', data.registration?.conf);
    set('chkHotelStart', data.hotel?.start);
    set('chkHotelEnd', data.hotel?.end);
    set('chkHotelConf', data.hotel?.conf);
    set('chkFlightDepart', data.flight?.depart);
    set('chkFlightReturn', data.flight?.return);
    set('chkFlightConf', data.flight?.conf);
    renderPresentations();
}

function saveChecklist() {
    const trip = getCurrentTrip();
    if (!trip) return;
    const get = id => (document.getElementById(id)?.value || '');
    checklists[trip.id] = {
        registration: { date: get('chkRegistrationDate'), conf: get('chkRegistrationConf') },
        hotel: { start: get('chkHotelStart'), end: get('chkHotelEnd'), conf: get('chkHotelConf') },
        flight: { depart: get('chkFlightDepart'), return: get('chkFlightReturn'), conf: get('chkFlightConf') },
        presentations: (checklists[trip.id]?.presentations) || []
    };
    localStorage.setItem('checklists', JSON.stringify(checklists));
    alert('Checklist saved');
}

function addPresentation() {
    const trip = getCurrentTrip();
    if (!trip) return;
    const name = (document.getElementById('chkPresentationName')?.value || '').trim();
    const typeEl = document.getElementById('chkPresentationType');
    const ptype = typeEl ? typeEl.value : 'Presentation';
    if (!name) return;
    if (!checklists[trip.id]) checklists[trip.id] = { registration:{}, hotel:{}, flight:{}, presentations:[] };
    checklists[trip.id].presentations = checklists[trip.id].presentations || [];
    checklists[trip.id].presentations.push({ name, type: ptype });
    localStorage.setItem('checklists', JSON.stringify(checklists));
    document.getElementById('chkPresentationName').value = '';
    renderPresentations();
}

function removePresentation(index) {
    const trip = getCurrentTrip();
    if (!trip) return;
    if (!checklists[trip.id] || !checklists[trip.id].presentations) return;
    checklists[trip.id].presentations.splice(index, 1);
    localStorage.setItem('checklists', JSON.stringify(checklists));
    renderPresentations();
}

function renderPresentations() {
    const trip = getCurrentTrip();
    const listEl = document.getElementById('chkPresentationsList');
    if (!trip || !listEl) return;
    const items = (checklists[trip.id] && checklists[trip.id].presentations) ? checklists[trip.id].presentations : [];
    if (items.length === 0) { listEl.innerHTML = '<p style="color:#64748b;">No presentations added</p>'; return; }
    listEl.innerHTML = '';
    items.forEach((p, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '6px 0';
        const type = p.type || 'Presentation';
        row.innerHTML = `
            <span style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:12px; padding:2px 8px; border:1px solid var(--border); border-radius:999px; background:#fff;">${type}</span>
              <span>${p.name}</span>
            </span>
            <button class="btn btn-danger" style="padding:4px 8px;" onclick="removePresentation(${idx})">Delete</button>
        `;
        listEl.appendChild(row);
    });
}

function toggleReceiptExpensed(index) {
    const trip = getCurrentTrip();
    if (!trip) return;
    
    const items = receipts[trip.id] || [];
    if (!items[index]) return;
    items[index].expensed = !items[index].expensed;
    localStorage.setItem('receipts', JSON.stringify(receipts));
    loadReceipts();
}

function migrateBudgetToReceiptsIfNeeded(tripId) {
    if (!tripId) return;
    const hasReceipts = receipts[tripId] && receipts[tripId].length > 0;
    const hasBudget = budgetItems[tripId] && budgetItems[tripId].length > 0;
    if (!hasReceipts && hasBudget) {
        receipts[tripId] = budgetItems[tripId].map(b => ({
            vendor: b.description || 'Unknown',
            amount: parseFloat(b.amount) || 0,
            category: b.category || 'Other',
            date: b.date ? (typeof b.date === 'string' ? b.date.split('T')[0] : new Date(b.date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
            note: '',
            expensed: false
        }));
        localStorage.setItem('receipts', JSON.stringify(receipts));
    }
}

// Tab Switching
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Set active tab button
    event.target.classList.add('active');

    // Initialize map when opening the Map tab
    if (tabName === 'map') {
        initMap();
        loadThingsToDo();
    }
    
    // Load weather when opening Weather tab
    if (tabName === 'weather') {
        loadWeather();
    }
    
    // Load API key when opening Settings tab
    if (tabName === 'settings') {
        loadApiKey();
    }
}

// Modal Functions
function showNewTripModal() {
    document.getElementById('newTripModal').classList.add('active');
}

function showAddEventModal() {
    const trip = getCurrentTrip();
    if (!trip) {
        alert('Please select a trip first');
        return;
    }
    document.getElementById('addEventModal').classList.add('active');
}

function showImportModal() {
    document.getElementById('importModal').classList.add('active');
}

function showUploadProgramModal() {
    // Placeholder for conference program upload
    alert('Upload conference program feature - to be implemented');
}

function showEmailImport() {
    const input = document.getElementById('emailPdfInput');
    if (input) input.click();
}

async function handleEmailPdfInput(input) {
    const trip = getCurrentTrip();
    if (!trip) { alert('Please select a trip first'); input.value=''; return; }
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(it => it.str).join(' ') + '\n';
        }
        const evt = parseEmailTextToEvent(text);
        // Prefill Add Event modal for confirmation
        document.getElementById('eventType').value = evt.type;
        document.getElementById('eventTitle').value = evt.title;
        document.getElementById('eventDate').value = evt.date;
        document.getElementById('eventStartTime').value = evt.startTime;
        document.getElementById('eventEndTime').value = evt.endTime;
        document.getElementById('eventLocation').value = evt.location;
        document.getElementById('eventDescription').value = evt.description;
        showAddEventModal();
    } catch (e) {
        console.error('PDF parse error', e);
        alert('Could not read the PDF. Please ensure it is a text-based email PDF.');
    } finally {
        input.value = '';
    }
}

function parseEmailTextToEvent(text) {
    const safe = (s) => (s || '').trim();
    const lines = text.split(/\n|\r|\r\n/).map(l => l.trim()).filter(Boolean);
    const full = lines.join(' ');
    // Title: first meaningful line or Subject: ...
    let title = (lines.find(l => /^subject[:\-]/i.test(l)) || '').replace(/^subject[:\-]\s*/i, '') || lines[0] || 'Event';
    // Date: try common formats
    const dateMatch = full.match(/(\b\d{4}[-\/]\d{1,2}[-\/]\d{1,2}\b)|(\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b)|((Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*,?\s*\w+\s*\d{1,2},\s*\d{4})/i);
    let date = '';
    if (dateMatch) {
        const raw = dateMatch[0];
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
            date = d.toISOString().slice(0,10);
        }
    }
    // Times: start and optional end
    const timeRegex = /\b(\d{1,2}:[0-5]\d\s*(AM|PM)?)\b/ig;
    const times = [...full.matchAll(timeRegex)].map(m => m[1].toUpperCase());
    const to24 = (t) => {
        if (!t) return '';
        let [h, rest] = t.split(':');
        let min = rest.replace(/[^0-9].*/, '');
        const ampm = (t.match(/AM|PM/i) || [''])[0].toUpperCase();
        h = parseInt(h,10);
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return `${String(h).padStart(2,'0')}:${min}`;
    };
    const startTime = to24(times[0] || '');
    const endTime = to24(times[1] || '');
    // Location: look for lines starting with Location or Address
    const locLine = lines.find(l => /^(location|address)[:\-]/i.test(l)) || '';
    const location = safe(locLine.replace(/^(location|address)[:\-]\s*/i, '')) || (function(){
        const m = full.match(/at\s+([A-Z0-9][^\.,\n]{3,60})/i);
        return m ? safe(m[1]) : '';
    })();
    // Description: keep first 400 chars around title/time block
    const description = safe(full.slice(0, 400));
    // Type heuristic: dinner/gathering => personal; conference keywords => conference; else personal
    let type = /dinner|gathering|reception|meetup/i.test(full) ? 'personal' : (/session|talk|conference|keynote|workshop/i.test(full) ? 'conference' : 'personal');
    return { title: safe(title), date, startTime, endTime, location, description, type };
}
function showAgendaModal() {
    const trip = getCurrentTrip();
    if (!trip) {
        alert('Please select a trip first');
        return;
    }
    const a = agendas[trip.id] || { url: '', text: '' };
    const urlEl = document.getElementById('agendaUrl');
    const textEl = document.getElementById('agendaText');
    if (urlEl) urlEl.value = a.url || '';
    if (textEl) textEl.value = a.text || '';
    renderAgendaPdfList();
    document.getElementById('agendaModal').classList.add('active');
}

function saveAgenda() {
    const trip = getCurrentTrip();
    if (!trip) {
        alert('Please select a trip first');
        return;
    }
    const url = (document.getElementById('agendaUrl').value || '').trim();
    const text = document.getElementById('agendaText').value || '';
    agendas[trip.id] = { url, text };
    localStorage.setItem('agendas', JSON.stringify(agendas));
    displayItinerary();
    closeModal('agendaModal');
}

function openAgendaUrl() {
    const trip = getCurrentTrip();
    if (!trip) return;
    const inputUrl = (document.getElementById('agendaUrl').value || '').trim();
    const saved = agendas[trip.id];
    const url = inputUrl || (saved && saved.url);
    if (!url) {
        alert('No agenda URL set');
        return;
    }
    window.open(url, '_blank');
}

// Agenda PDFs (stored as data URLs in LocalStorage)
function handleAgendaPdfSelect(input) {
    const trip = getCurrentTrip();
    if (!trip || !input.files || input.files.length === 0) return;
    const files = Array.from(input.files);
    if (!agendaPdfs[trip.id]) agendaPdfs[trip.id] = [];
    const readers = files.map(file => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = e => resolve({ name: file.name, dataUrl: e.target.result });
        reader.readAsDataURL(file);
    }));
    Promise.all(readers).then(items => {
        agendaPdfs[trip.id].push(...items);
        localStorage.setItem('agendaPdfs', JSON.stringify(agendaPdfs));
        renderAgendaPdfList();
        input.value = '';
    });
}

function renderAgendaPdfList() {
    const trip = getCurrentTrip();
    const listEl = document.getElementById('agendaPdfList');
    if (!listEl) return;
    const items = (trip && agendaPdfs[trip.id]) ? agendaPdfs[trip.id] : [];
    if (!items || items.length === 0) {
        listEl.innerHTML = '<p style="color:#64748b;">No PDFs uploaded yet</p>';
        return;
    }
    listEl.innerHTML = '';
    items.forEach((pdf, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '6px 0';
        row.innerHTML = `
            <span>${pdf.name}</span>
            <span style="display:flex; gap:8px;">
                <button class="btn btn-secondary" style="padding:4px 8px;" onclick="openAgendaPdf(${idx})">View</button>
                <button class="btn btn-danger" style="padding:4px 8px;" onclick="deleteAgendaPdf(${idx})">Delete</button>
            </span>
        `;
        listEl.appendChild(row);
    });
}

function openAgendaPdf(index) {
    const trip = getCurrentTrip();
    if (!trip) return;
    const item = agendaPdfs[trip.id] && agendaPdfs[trip.id][index];
    if (!item) return;
    const w = window.open('about:blank');
    if (w) {
        w.document.write(`<iframe src="${item.dataUrl}" style="width:100%;height:100%;border:0;"></iframe>`);
    }
}

function deleteAgendaPdf(index) {
    const trip = getCurrentTrip();
    if (!trip) return;
    if (!agendaPdfs[trip.id]) return;
    agendaPdfs[trip.id].splice(index, 1);
    localStorage.setItem('agendaPdfs', JSON.stringify(agendaPdfs));
    renderAgendaPdfList();
}

// Map: initialize Leaflet and center on trip destination via Nominatim
function initMap() {
    const container = document.getElementById('leafletMap');
    if (!container) return;
    if (!leafletMap) {
        leafletMap = L.map('leafletMap');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(leafletMap);
    }
    
    // Clear existing markers
    leafletMarkers.forEach(m => m.remove());
    leafletMarkers = [];
    if (leafletMarker) {
        leafletMarker.remove();
        leafletMarker = null;
    }
    
    const trip = getCurrentTrip();
    if (!trip) {
        leafletMap.setView([20, 0], 2);
        return;
    }
    
    // Collect all unique locations from events
    const locations = [];
    if (trip.events && trip.events.length > 0) {
        trip.events.forEach(event => {
            if (event.location && event.location.trim()) {
                // Check if location already exists
                const existing = locations.find(loc => loc.name.toLowerCase() === event.location.toLowerCase());
                if (!existing) {
                    locations.push({
                        name: event.location,
                        events: [event.title]
                    });
                } else {
                    existing.events.push(event.title);
                }
            }
        });
    }
    
    // Add trip destination as well
    if (trip.destination) {
        const existing = locations.find(loc => loc.name.toLowerCase() === trip.destination.toLowerCase());
        if (!existing) {
            locations.push({
                name: trip.destination,
                events: ['Trip Destination']
            });
        }
    }
    
    if (locations.length === 0) {
        leafletMap.setView([20, 0], 2);
        return;
    }
    
    // Geocode and add markers for all locations
    const promises = locations.map(loc => 
        geocodeDestination(loc.name).then(coords => {
            if (coords) {
                return { ...loc, coords };
            }
            return null;
        })
    );
    
    Promise.all(promises).then(results => {
        const validLocations = results.filter(r => r !== null);
        
        if (validLocations.length === 0) {
            leafletMap.setView([20, 0], 2);
            return;
        }
        
        // Add markers for each location
        validLocations.forEach((loc, index) => {
            const popupContent = `<div style="font-weight:600; margin-bottom:4px;">${loc.name}</div>
                <div style="font-size:0.85em; color:#64748b;">${loc.events.join('<br>')}</div>`;
            const marker = L.marker([loc.coords.lat, loc.coords.lon])
                .addTo(leafletMap)
                .bindPopup(popupContent);
            leafletMarkers.push(marker);
        });
        
        // Fit map to show all markers
        if (validLocations.length === 1) {
            leafletMap.setView([validLocations[0].coords.lat, validLocations[0].coords.lon], 12);
        } else {
            const bounds = L.latLngBounds(validLocations.map(loc => [loc.coords.lat, loc.coords.lon]));
            leafletMap.fitBounds(bounds, { padding: [50, 50] });
        }
        
        // Update location list in UI
        updateMapLocationList(validLocations);
    });
}

function updateMapLocationList(locations) {
    const listContainer = document.getElementById('mapLocationsList');
    if (!listContainer) return;
    
    if (locations.length === 0) {
        listContainer.innerHTML = '<p style="color:#64748b; padding:10px;">No locations found in itinerary</p>';
        return;
    }
    
    listContainer.innerHTML = '';
    locations.forEach((loc, index) => {
        const item = document.createElement('div');
        item.style.padding = '10px';
        item.style.borderBottom = '1px solid var(--border)';
        item.style.cursor = 'pointer';
        item.innerHTML = `
            <div style="font-weight:600; margin-bottom:4px;">${loc.name}</div>
            <div style="font-size:0.85em; color:#64748b;">${loc.events.length} event(s)</div>
        `;
        item.onclick = () => {
            leafletMap.setView([loc.coords.lat, loc.coords.lon], 14);
            leafletMarkers[index].openPopup();
        };
        listContainer.appendChild(item);
    });
}

function geocodeDestination(query) {
    const queryLower = query.toLowerCase().trim();
    
    // Direct fallback coordinates for common cities (EXACT coordinates)
    const cityCoordinates = {
        'dallas': { lat: 32.7767, lon: -96.7970, name: 'Dallas, Texas, USA' },
        'dallas, texas': { lat: 32.7767, lon: -96.7970, name: 'Dallas, Texas, USA' },
        'dallas, tx': { lat: 32.7767, lon: -96.7970, name: 'Dallas, Texas, USA' },
        'dallas texas': { lat: 32.7767, lon: -96.7970, name: 'Dallas, Texas, USA' },
        'new york': { lat: 40.7128, lon: -74.0060, name: 'New York, NY, USA' },
        'los angeles': { lat: 34.0522, lon: -118.2437, name: 'Los Angeles, CA, USA' },
        'chicago': { lat: 41.8781, lon: -87.6298, name: 'Chicago, IL, USA' },
        'miami': { lat: 25.7617, lon: -80.1918, name: 'Miami, FL, USA' },
        'san francisco': { lat: 37.7749, lon: -122.4194, name: 'San Francisco, CA, USA' },
        'boston': { lat: 42.3601, lon: -71.0589, name: 'Boston, MA, USA' },
        'seattle': { lat: 47.6062, lon: -122.3321, name: 'Seattle, WA, USA' },
        'detroit': { lat: 42.3314, lon: -83.0458, name: 'Detroit, Michigan, USA' },
        'detroit, michigan': { lat: 42.3314, lon: -83.0458, name: 'Detroit, Michigan, USA' },
        'detroit, mi': { lat: 42.3314, lon: -83.0458, name: 'Detroit, Michigan, USA' },
        'las vegas': { lat: 36.1699, lon: -115.1398, name: 'Las Vegas, NV, USA' },
    };
    
    // Check if we have a direct match
    if (cityCoordinates[queryLower]) {
        console.log('Using fallback coordinates for:', query);
        return Promise.resolve(cityCoordinates[queryLower]);
    }
    
    // Detect if this is likely a US location
    const usStateNames = ['alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 
                          'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 
                          'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 
                          'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 
                          'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 
                          'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 
                          'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming'];
    
    const usStateAbbrev = ['al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'id', 'il', 'in', 'ia', 
                           'ks', 'ky', 'la', 'me', 'md', 'ma', 'mi', 'mn', 'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 
                           'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 
                           'va', 'wa', 'wv', 'wi', 'wy'];
    
    const isUSQuery = queryLower.includes('usa') || 
                      queryLower.includes('united states') ||
                      usStateNames.some(state => queryLower.includes(state)) ||
                      usStateAbbrev.some(abbrev => queryLower.includes(', ' + abbrev));
    
    // Build URL with country filter if US query detected
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1`;
    if (isUSQuery) {
        url += '&countrycodes=us';
        console.log('Detected US query, filtering to US only:', query);
    }
    
    return fetch(url, { headers: { 'Accept-Language': 'en' } })
        .then(r => r.json())
        .then(results => {
            if (!results || results.length === 0) {
                console.log('No geocoding results for:', query);
                return null;
            }
            
            console.log('Geocoding results for', query, ':', results.length, 'results');
            
            // Prefer city/town results
            const cityResult = results.find(r => 
                (r.type === 'city' || r.type === 'town' || r.class === 'place') &&
                (r.address?.country_code === 'us' || !isUSQuery)
            );
            
            const bestResult = cityResult || results[0];
            console.log('Selected result:', bestResult.display_name);
            
            return { lat: parseFloat(bestResult.lat), lon: parseFloat(bestResult.lon) };
        })
        .catch(err => {
            console.error('Geocoding error:', err);
            return null;
        });
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Things to Do recommendations
function loadThingsToDo() {
    console.log('🎯 loadThingsToDo() called');
    const trip = getCurrentTrip();
    const thingsToDoList = document.getElementById('thingsToDoList');
    
    console.log('Things to Do element found:', !!thingsToDoList);
    
    if (!thingsToDoList) {
        console.error('❌ thingsToDoList element not found in DOM');
        return;
    }
    
    if (!trip) {
        console.log('ℹ️ No trip selected');
        thingsToDoList.innerHTML = '<p style="color:#64748b;">No trip selected</p>';
        return;
    }
    
    console.log('🗺️ Loading Things to Do for trip:', trip.name, 'Destination:', trip.destination);
    
    // Extract destination city (same logic as background/weather)
    let destination = trip.destination || '';
    
    // Try to extract from flight events
    const flightEvents = trip.events ? trip.events.filter(e => e.type === 'flight') : [];
    if (flightEvents.length > 0) {
        const arrivalFlight = flightEvents.find(f => 
            f.title && (f.title.toLowerCase().includes(' to ') || 
            f.description && f.description.toLowerCase().includes('arrival'))
        ) || flightEvents[flightEvents.length - 1];
        
        const searchText = `${arrivalFlight.location || ''} ${arrivalFlight.title || ''} ${arrivalFlight.description || ''}`;
        destination = arrivalFlight.location || destination;
        console.log('✈️ Extracted destination from flight:', destination);
    }
    
    const destLower = destination.toLowerCase();
    console.log('🔍 Searching recommendations for:', destLower);
    
    // Curated recommendations for major cities
    const recommendations = {
        'dallas': {
            attractions: [
                { name: 'Sixth Floor Museum', desc: 'JFK assassination history', icon: '🏛️' },
                { name: 'Dallas Arboretum', desc: 'Beautiful botanical gardens', icon: '🌸' },
                { name: 'Reunion Tower', desc: 'Observation deck & city views', icon: '🗼' },
                { name: 'Dallas Arts District', desc: 'Museums & performing arts', icon: '🎨' }
            ],
            dining: [
                { name: 'Pecan Lodge', desc: 'Famous BBQ in Deep Ellum', icon: '🍖' },
                { name: 'The Mansion Restaurant', desc: 'Fine dining', icon: '🍽️' },
                { name: 'Uchi', desc: 'Contemporary sushi', icon: '🍱' },
                { name: 'Mi Cocina', desc: 'Tex-Mex favorite', icon: '🌮' }
            ],
            activities: [
                { name: 'Bishop Arts District', desc: 'Shopping & galleries', icon: '🛍️' },
                { name: 'AT&T Stadium Tour', desc: 'Cowboys stadium', icon: '🏈' },
                { name: 'Fort Worth Stockyards', desc: 'Western heritage (30 min)', icon: '🤠' }
            ]
        },
        'new york': {
            attractions: [
                { name: 'Statue of Liberty', desc: 'Iconic landmark', icon: '🗽' },
                { name: 'Central Park', desc: 'Urban oasis', icon: '🌳' },
                { name: 'Empire State Building', desc: 'Classic observation deck', icon: '🏢' },
                { name: 'MoMA', desc: 'Modern art museum', icon: '🎨' }
            ],
            dining: [
                { name: 'Katz\'s Delicatessen', desc: 'Famous pastrami', icon: '🥪' },
                { name: 'Joe\'s Pizza', desc: 'Classic NY slice', icon: '🍕' },
                { name: 'Peter Luger', desc: 'Legendary steakhouse', icon: '🥩' },
                { name: 'Momofuku Noodle Bar', desc: 'Asian fusion', icon: '🍜' }
            ],
            activities: [
                { name: 'Times Square', desc: 'Bright lights & Broadway', icon: '🎭' },
                { name: 'Brooklyn Bridge Walk', desc: 'Iconic bridge crossing', icon: '🌉' },
                { name: 'High Line Park', desc: 'Elevated urban park', icon: '🚶' }
            ]
        },
        'chicago': {
            attractions: [
                { name: 'Cloud Gate (The Bean)', desc: 'Millennium Park icon', icon: '🫘' },
                { name: 'Willis Tower Skydeck', desc: 'Glass ledge views', icon: '🏙️' },
                { name: 'Art Institute', desc: 'World-class museum', icon: '🎨' },
                { name: 'Navy Pier', desc: 'Lakefront entertainment', icon: '🎡' }
            ],
            dining: [
                { name: 'Lou Malnati\'s', desc: 'Deep dish pizza', icon: '🍕' },
                { name: 'Portillo\'s', desc: 'Chicago hot dogs', icon: '🌭' },
                { name: 'Alinea', desc: 'Michelin 3-star dining', icon: '⭐' },
                { name: 'Girl & The Goat', desc: 'Innovative American', icon: '🍽️' }
            ],
            activities: [
                { name: 'Architecture River Cruise', desc: 'See famous buildings', icon: '🚢' },
                { name: 'Lakefront Trail', desc: 'Biking & walking', icon: '🚴' },
                { name: 'Wrigley Field Tour', desc: 'Historic Cubs ballpark', icon: '⚾' }
            ]
        },
        'los angeles': {
            attractions: [
                { name: 'Hollywood Sign', desc: 'Iconic landmark', icon: '🎬' },
                { name: 'Griffith Observatory', desc: 'Space & city views', icon: '🔭' },
                { name: 'Getty Center', desc: 'Art & architecture', icon: '🏛️' },
                { name: 'Santa Monica Pier', desc: 'Beach & amusement', icon: '🎢' }
            ],
            dining: [
                { name: 'In-N-Out Burger', desc: 'California classic', icon: '🍔' },
                { name: 'Grand Central Market', desc: 'Food hall variety', icon: '🍴' },
                { name: 'Bestia', desc: 'Italian hot spot', icon: '🍝' },
                { name: 'Republique', desc: 'French bistro', icon: '🥐' }
            ],
            activities: [
                { name: 'Venice Beach Boardwalk', desc: 'People watching & shops', icon: '🏖️' },
                { name: 'Rodeo Drive', desc: 'Luxury shopping', icon: '💎' },
                { name: 'Universal Studios', desc: 'Theme park', icon: '🎪' }
            ]
        },
        'san francisco': {
            attractions: [
                { name: 'Golden Gate Bridge', desc: 'Walk or bike across', icon: '🌉' },
                { name: 'Alcatraz Island', desc: 'Historic prison tour', icon: '🏝️' },
                { name: 'Fisherman\'s Wharf', desc: 'Seafood & sea lions', icon: '🦭' },
                { name: 'Cable Cars', desc: 'Historic transit ride', icon: '🚡' }
            ],
            dining: [
                { name: 'Tartine Bakery', desc: 'Famous bread & pastries', icon: '🥖' },
                { name: 'Swan Oyster Depot', desc: 'Fresh seafood', icon: '🦪' },
                { name: 'Mission Chinese Food', desc: 'Modern Chinese', icon: '🥟' },
                { name: 'Gary Danko', desc: 'Fine dining', icon: '⭐' }
            ],
            activities: [
                { name: 'Chinatown', desc: 'Oldest in North America', icon: '🏮' },
                { name: 'Lombard Street', desc: 'Crooked street', icon: '🛣️' },
                { name: 'Muir Woods', desc: 'Redwood forest (30 min)', icon: '🌲' }
            ]
        },
        'miami': {
            attractions: [
                { name: 'South Beach', desc: 'Art Deco & beaches', icon: '🏖️' },
                { name: 'Wynwood Walls', desc: 'Street art district', icon: '🎨' },
                { name: 'Vizcaya Museum', desc: 'Historic mansion', icon: '🏰' },
                { name: 'Everglades', desc: 'Airboat tours', icon: '🐊' }
            ],
            dining: [
                { name: 'Joe\'s Stone Crab', desc: 'Miami institution', icon: '🦀' },
                { name: 'Versailles', desc: 'Cuban cuisine', icon: '🍛' },
                { name: 'Zuma', desc: 'Japanese izakaya', icon: '🍱' },
                { name: 'La Mar', desc: 'Peruvian ceviche', icon: '🐟' }
            ],
            activities: [
                { name: 'Lincoln Road', desc: 'Shopping & dining', icon: '🛍️' },
                { name: 'Little Havana', desc: 'Cuban culture', icon: '🇨🇺' },
                { name: 'Biscayne Bay Cruise', desc: 'Boat tours', icon: '⛵' }
            ]
        },
        'las vegas': {
            attractions: [
                { name: 'Bellagio Fountains', desc: 'Free water show', icon: '⛲' },
                { name: 'Fremont Street', desc: 'LED canopy experience', icon: '💡' },
                { name: 'High Roller', desc: 'Observation wheel', icon: '🎡' },
                { name: 'Red Rock Canyon', desc: 'Desert scenery (20 min)', icon: '🏜️' }
            ],
            dining: [
                { name: 'Gordon Ramsay Hell\'s Kitchen', desc: 'Celebrity chef', icon: '🔥' },
                { name: 'Bacchanal Buffet', desc: 'Best buffet', icon: '🍽️' },
                { name: 'Secret Pizza', desc: 'Hidden gem', icon: '🍕' },
                { name: 'Lotus of Siam', desc: 'Thai cuisine', icon: '🍜' }
            ],
            activities: [
                { name: 'Casino Hopping', desc: 'Try your luck', icon: '🎰' },
                { name: 'Cirque du Soleil', desc: 'World-class shows', icon: '🎪' },
                { name: 'Grand Canyon Tour', desc: 'Helicopter or bus', icon: '🚁' }
            ]
        },
        'orlando': {
            attractions: [
                { name: 'Walt Disney World', desc: 'Magic Kingdom & more', icon: '🏰' },
                { name: 'Universal Studios', desc: 'Wizarding World', icon: '⚡' },
                { name: 'Kennedy Space Center', desc: 'NASA tours (1 hr)', icon: '🚀' },
                { name: 'SeaWorld', desc: 'Marine life shows', icon: '🐬' }
            ],
            dining: [
                { name: 'Victoria & Albert\'s', desc: 'Fine dining at Grand Floridian', icon: '⭐' },
                { name: 'The Boathouse', desc: 'Waterfront seafood', icon: '🦞' },
                { name: 'Prato', desc: 'Farm-to-table Italian', icon: '🍝' },
                { name: '4 Rivers Smokehouse', desc: 'BBQ', icon: '🍖' }
            ],
            activities: [
                { name: 'Disney Springs', desc: 'Shopping & entertainment', icon: '🛍️' },
                { name: 'International Drive', desc: 'Tourist attractions', icon: '🎢' },
                { name: 'Airboat Tours', desc: 'See alligators', icon: '🐊' }
            ]
        },
        'boston': {
            attractions: [
                { name: 'Freedom Trail', desc: '2.5 mile historic walk', icon: '🧱' },
                { name: 'Fenway Park', desc: 'Oldest MLB ballpark', icon: '⚾' },
                { name: 'Museum of Fine Arts', desc: 'World-class collection', icon: '🎨' },
                { name: 'New England Aquarium', desc: 'Marine exhibits', icon: '🐠' }
            ],
            dining: [
                { name: 'Union Oyster House', desc: 'Oldest restaurant (1826)', icon: '🦪' },
                { name: 'Mike\'s Pastry', desc: 'Famous cannolis', icon: '🍰' },
                { name: 'Neptune Oyster', desc: 'Seafood', icon: '🦞' },
                { name: 'Legal Sea Foods', desc: 'New England clam chowder', icon: '🥣' }
            ],
            activities: [
                { name: 'Boston Common', desc: 'Historic park', icon: '🌳' },
                { name: 'Harvard/MIT Campus', desc: 'University tours', icon: '🎓' },
                { name: 'Harbor Cruise', desc: 'Waterfront views', icon: '⛴️' }
            ]
        },
        'seattle': {
            attractions: [
                { name: 'Space Needle', desc: 'Rotating glass floor', icon: '🗼' },
                { name: 'Pike Place Market', desc: 'Fish throwing & crafts', icon: '🐟' },
                { name: 'Chihuly Garden', desc: 'Glass art museum', icon: '🎨' },
                { name: 'Museum of Pop Culture', desc: 'Music & sci-fi', icon: '🎸' }
            ],
            dining: [
                { name: 'Piroshky Piroshky', desc: 'Russian pastries', icon: '🥟' },
                { name: 'Dick\'s Drive-In', desc: 'Local burger chain', icon: '🍔' },
                { name: 'The Pink Door', desc: 'Italian with entertainment', icon: '🍝' },
                { name: 'Canlis', desc: 'Fine dining', icon: '⭐' }
            ],
            activities: [
                { name: 'Ferry to Bainbridge', desc: 'Scenic ride', icon: '⛴️' },
                { name: 'Underground Tour', desc: 'Historic streets', icon: '🏛️' },
                { name: 'Mt. Rainier', desc: 'Day trip (2 hrs)', icon: '⛰️' }
            ]
        },
        // International Cities
        'paris': {
            attractions: [
                { name: 'Eiffel Tower', desc: 'Iconic iron lattice tower', icon: '🗼' },
                { name: 'Louvre Museum', desc: 'Mona Lisa & art treasures', icon: '🎨' },
                { name: 'Notre-Dame Cathedral', desc: 'Gothic masterpiece', icon: '⛪' },
                { name: 'Arc de Triomphe', desc: 'Champs-Élysées monument', icon: '🏛️' }
            ],
            dining: [
                { name: 'Le Jules Verne', desc: 'Eiffel Tower restaurant', icon: '⭐' },
                { name: 'L\'Ami Jean', desc: 'Basque bistro', icon: '🍷' },
                { name: 'Ladurée', desc: 'Famous macarons', icon: '🥐' },
                { name: 'Bouillon Chartier', desc: 'Historic brasserie', icon: '🍽️' }
            ],
            activities: [
                { name: 'Seine River Cruise', desc: 'See Paris from water', icon: '🚢' },
                { name: 'Montmartre & Sacré-Cœur', desc: 'Artist district', icon: '🎨' },
                { name: 'Versailles Palace', desc: 'Day trip (30 min)', icon: '👑' }
            ]
        },
        'london': {
            attractions: [
                { name: 'Tower of London', desc: 'Crown Jewels & history', icon: '👑' },
                { name: 'British Museum', desc: 'World artifacts', icon: '🏛️' },
                { name: 'Buckingham Palace', desc: 'Changing of the Guard', icon: '💂' },
                { name: 'London Eye', desc: 'River Thames views', icon: '🎡' }
            ],
            dining: [
                { name: 'Dishoom', desc: 'Bombay café', icon: '🍛' },
                { name: 'Borough Market', desc: 'Food market', icon: '🍴' },
                { name: 'The Ivy', desc: 'British classics', icon: '🇬🇧' },
                { name: 'Sketch', desc: 'Afternoon tea', icon: '☕' }
            ],
            activities: [
                { name: 'West End Theatre', desc: 'Musicals & plays', icon: '🎭' },
                { name: 'Camden Market', desc: 'Alternative shopping', icon: '🛍️' },
                { name: 'Harry Potter Studio Tour', desc: 'Warner Bros (1 hr)', icon: '⚡' }
            ]
        },
        'rome': {
            attractions: [
                { name: 'Colosseum', desc: 'Ancient amphitheater', icon: '🏛️' },
                { name: 'Vatican Museums', desc: 'Sistine Chapel', icon: '🎨' },
                { name: 'Trevi Fountain', desc: 'Throw a coin', icon: '⛲' },
                { name: 'Roman Forum', desc: 'Ancient ruins', icon: '🏺' }
            ],
            dining: [
                { name: 'Roscioli', desc: 'Carbonara & wine', icon: '🍝' },
                { name: 'Pizzarium', desc: 'Pizza al taglio', icon: '🍕' },
                { name: 'Trattoria Da Enzo', desc: 'Traditional Roman', icon: '🍷' },
                { name: 'Giolitti', desc: 'Historic gelato', icon: '🍦' }
            ],
            activities: [
                { name: 'Trastevere District', desc: 'Charming neighborhood', icon: '🌆' },
                { name: 'Spanish Steps', desc: 'Shopping & people watching', icon: '🛍️' },
                { name: 'Pompeii Day Trip', desc: 'Ancient city (2.5 hrs)', icon: '🏔️' }
            ]
        },
        'tokyo': {
            attractions: [
                { name: 'Senso-ji Temple', desc: 'Tokyo\'s oldest temple', icon: '⛩️' },
                { name: 'Tokyo Skytree', desc: 'Tallest structure', icon: '🗼' },
                { name: 'Meiji Shrine', desc: 'Peaceful forest shrine', icon: '🌳' },
                { name: 'teamLab Borderless', desc: 'Digital art museum', icon: '🎨' }
            ],
            dining: [
                { name: 'Sukiyabashi Jiro', desc: '3-star sushi', icon: '🍣' },
                { name: 'Ichiran Ramen', desc: 'Solo booths', icon: '🍜' },
                { name: 'Tsukiji Outer Market', desc: 'Fresh seafood', icon: '🐟' },
                { name: 'Gonpachi', desc: 'Kill Bill restaurant', icon: '🥢' }
            ],
            activities: [
                { name: 'Shibuya Crossing', desc: 'World\'s busiest intersection', icon: '🚦' },
                { name: 'Akihabara', desc: 'Anime & electronics', icon: '🎮' },
                { name: 'Mount Fuji Day Trip', desc: 'Iconic mountain (2 hrs)', icon: '🗻' }
            ]
        },
        'barcelona': {
            attractions: [
                { name: 'Sagrada Família', desc: 'Gaudí\'s masterpiece', icon: '⛪' },
                { name: 'Park Güell', desc: 'Colorful mosaic park', icon: '🎨' },
                { name: 'La Rambla', desc: 'Famous pedestrian street', icon: '🚶' },
                { name: 'Casa Batlló', desc: 'Modernist architecture', icon: '🏛️' }
            ],
            dining: [
                { name: 'Cervecería Catalana', desc: 'Tapas paradise', icon: '🍷' },
                { name: 'La Boqueria Market', desc: 'Food market', icon: '🍴' },
                { name: 'Can Culleretes', desc: 'Oldest restaurant (1786)', icon: '🍽️' },
                { name: 'Tickets Bar', desc: 'Molecular gastronomy', icon: '⭐' }
            ],
            activities: [
                { name: 'Beach Day', desc: 'Barceloneta Beach', icon: '🏖️' },
                { name: 'Gothic Quarter', desc: 'Medieval streets', icon: '🏰' },
                { name: 'Montserrat', desc: 'Mountain monastery (1 hr)', icon: '⛰️' }
            ]
        },
        'dubai': {
            attractions: [
                { name: 'Burj Khalifa', desc: 'World\'s tallest building', icon: '🏙️' },
                { name: 'Dubai Mall', desc: 'Massive shopping center', icon: '🛍️' },
                { name: 'Palm Jumeirah', desc: 'Artificial island', icon: '🌴' },
                { name: 'Dubai Frame', desc: 'Golden picture frame', icon: '🖼️' }
            ],
            dining: [
                { name: 'At.mosphere', desc: 'Burj Khalifa dining', icon: '⭐' },
                { name: 'Al Fanar', desc: 'Traditional Emirati', icon: '🍛' },
                { name: 'Pierchic', desc: 'Seafood on pier', icon: '🦞' },
                { name: 'Ravi Restaurant', desc: 'Pakistani comfort food', icon: '🍽️' }
            ],
            activities: [
                { name: 'Desert Safari', desc: 'Dune bashing & BBQ', icon: '🐪' },
                { name: 'Gold Souk', desc: 'Traditional market', icon: '💍' },
                { name: 'Ski Dubai', desc: 'Indoor skiing', icon: '⛷️' }
            ]
        }
    };
    
    // Find matching city
    let cityData = null;
    let cityName = '';
    for (const [city, data] of Object.entries(recommendations)) {
        if (destLower.includes(city)) {
            cityData = data;
            cityName = city.charAt(0).toUpperCase() + city.slice(1);
            break;
        }
    }
    
    if (!cityData) {
        thingsToDoList.innerHTML = `
            <p style="color:#64748b;">No recommendations available for this destination yet.</p>
            <p style="color:#64748b; font-size:0.85em; margin-top:10px;"><strong>US:</strong> Dallas, New York, Chicago, Los Angeles, San Francisco, Miami, Las Vegas, Orlando, Boston, Seattle</p>
            <p style="color:#64748b; font-size:0.85em; margin-top:6px;"><strong>International:</strong> Paris, London, Rome, Tokyo, Barcelona, Dubai</p>
        `;
        return;
    }
    
    // Fetch live events if API key is available
    const apiKey = localStorage.getItem('ticketmasterApiKey');
    
    if (apiKey && trip && trip.startDate) {
        // Load live events asynchronously
        fetchLiveEvents(cityName, trip.startDate, trip.endDate).then(events => {
            if (events && events.length > 0) {
                displayThingsToDoWithEvents(cityName, cityData, events);
            }
        });
    }
    
    // Build recommendations HTML
    let html = `<div style="font-size:0.9em; color:#64748b; margin-bottom:12px;">Recommendations for ${cityName}</div>`;
    
    // Live Events section (will be populated if API key exists)
    if (apiKey) {
        html += `<div id="liveEventsSection" style="margin-bottom:16px;">
            <strong style="font-size:0.95em;">🎫 Live Events</strong>
            <div style="padding:8px; color:#64748b; font-size:0.85em;">Loading events...</div>
        </div>`;
    }
    
    // Attractions
    html += '<div style="margin-bottom:16px;"><strong style="font-size:0.95em;">🎯 Top Attractions</strong>';
    cityData.attractions.forEach(item => {
        html += `
            <div style="margin:8px 0; padding:8px; background:#f8fafc; border-radius:6px; border-left:3px solid #3b82f6;">
                <div style="font-weight:600; font-size:0.9em;">${item.icon} ${item.name}</div>
                <div style="color:#64748b; font-size:0.85em;">${item.desc}</div>
            </div>
        `;
    });
    html += '</div>';
    
    // Dining
    html += '<div style="margin-bottom:16px;"><strong style="font-size:0.95em;">🍴 Where to Eat</strong>';
    cityData.dining.forEach(item => {
        html += `
            <div style="margin:8px 0; padding:8px; background:#f8fafc; border-radius:6px; border-left:3px solid #10b981;">
                <div style="font-weight:600; font-size:0.9em;">${item.icon} ${item.name}</div>
                <div style="color:#64748b; font-size:0.85em;">${item.desc}</div>
            </div>
        `;
    });
    html += '</div>';
    
    // Activities
    html += '<div><strong style="font-size:0.95em;">🎉 Activities</strong>';
    cityData.activities.forEach(item => {
        html += `
            <div style="margin:8px 0; padding:8px; background:#f8fafc; border-radius:6px; border-left:3px solid #f59e0b;">
                <div style="font-weight:600; font-size:0.9em;">${item.icon} ${item.name}</div>
                <div style="color:#64748b; font-size:0.85em;">${item.desc}</div>
            </div>
        `;
    });
    html += '</div>';
    
    thingsToDoList.innerHTML = html;
}

// Weather functionality
function loadWeather() {
    const trip = getCurrentTrip();
    const weatherContent = document.querySelector('#weatherTab .weather-widget');
    
    if (!trip) {
        weatherContent.innerHTML = `
            <h3>Weather Forecast</h3>
            <p style="color:#64748b;">No trip selected</p>
        `;
        return;
    }
    
    // Find flight events to extract destination
    const flightEvents = trip.events ? trip.events.filter(e => e.type === 'flight') : [];
    let destination = null;
    
    // Try to extract destination from flight event location or description
    if (flightEvents.length > 0) {
        // Look for arrival flight or last flight
        const arrivalFlight = flightEvents.find(f => 
            f.title && (f.title.toLowerCase().includes(' to ') || 
            f.description && f.description.toLowerCase().includes('arrival'))
        ) || flightEvents[flightEvents.length - 1];
        
        // Try to extract airport code from location, title, or description
        const searchText = `${arrivalFlight.location || ''} ${arrivalFlight.title || ''} ${arrivalFlight.description || ''}`.toLowerCase();
        
        // Look for 3-letter airport codes (e.g., DFW, LAX, JFK)
        const airportCodeMatch = searchText.match(/\b([a-z]{3})\b/g);
        if (airportCodeMatch && airportCodeMatch.length > 0) {
            // Use the last airport code found (likely the destination)
            destination = airportCodeMatch[airportCodeMatch.length - 1].toUpperCase();
            console.log(`☀️ Extracted airport code ${destination} from flight for weather`);
        } else {
            // Fall back to location or trip destination
            destination = arrivalFlight.location || trip.destination;
        }
    } else {
        // Fall back to trip destination
        destination = trip.destination;
    }
    
    if (!destination) {
        weatherContent.innerHTML = `
            <h3>Weather Forecast</h3>
            <p style="color:#64748b;">No destination found. Add a flight event or set trip destination to see weather.</p>
        `;
        return;
    }
    
    // Show loading state
    weatherContent.innerHTML = `
        <h3>Weather Forecast for ${destination}</h3>
        <p style="color:#64748b;">Loading weather data...</p>
    `;
    
    // Geocode the destination first
    geocodeDestination(destination).then(coords => {
        if (!coords) {
            weatherContent.innerHTML = `
                <h3>Weather Forecast</h3>
                <p style="color:#dc2626;">Could not find location: ${destination}</p>
            `;
            return;
        }
        
        console.log(`🌤️ Weather coordinates for ${destination}:`, coords.lat, coords.lon);
        console.log(`🌐 Google Maps link: https://www.google.com/maps?q=${coords.lat},${coords.lon}`);
        
        // Fetch weather data from Open-Meteo (free, no API key needed)
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&temperature_unit=fahrenheit&timezone=auto&forecast_days=7`;
        
        console.log('📡 Fetching weather from:', weatherUrl);
        
        fetch(weatherUrl)
            .then(r => r.json())
            .then(data => {
                console.log('☀️ Weather data received:', data);
                displayWeather(destination, data, trip, coords);
            })
            .catch(err => {
                console.error('Weather fetch error:', err);
                weatherContent.innerHTML = `
                    <h3>Weather Forecast</h3>
                    <p style="color:#dc2626;">Could not load weather data. Please try again later.</p>
                `;
            });
    });
}

function displayWeather(destination, weatherData, trip, coords) {
    const weatherContent = document.querySelector('#weatherTab .weather-widget');
    
    if (!weatherData || !weatherData.daily) {
        weatherContent.innerHTML = `
            <h3>Weather Forecast</h3>
            <p style="color:#dc2626;">Invalid weather data received</p>
        `;
        return;
    }
    
    const daily = weatherData.daily;
    const tripStart = trip.startDate ? new Date(trip.startDate) : null;
    const tripEnd = trip.endDate ? new Date(trip.endDate) : null;
    
    // Weather code to icon/description mapping
    const weatherCodeMap = {
        0: { icon: '☀️', desc: 'Clear sky' },
        1: { icon: '🌤️', desc: 'Mainly clear' },
        2: { icon: '⛅', desc: 'Partly cloudy' },
        3: { icon: '☁️', desc: 'Overcast' },
        45: { icon: '🌫️', desc: 'Foggy' },
        48: { icon: '🌫️', desc: 'Foggy' },
        51: { icon: '🌦️', desc: 'Light drizzle' },
        53: { icon: '🌦️', desc: 'Moderate drizzle' },
        55: { icon: '🌧️', desc: 'Heavy drizzle' },
        61: { icon: '🌧️', desc: 'Light rain' },
        63: { icon: '🌧️', desc: 'Moderate rain' },
        65: { icon: '🌧️', desc: 'Heavy rain' },
        71: { icon: '🌨️', desc: 'Light snow' },
        73: { icon: '🌨️', desc: 'Moderate snow' },
        75: { icon: '❄️', desc: 'Heavy snow' },
        77: { icon: '🌨️', desc: 'Snow grains' },
        80: { icon: '🌦️', desc: 'Light showers' },
        81: { icon: '🌧️', desc: 'Moderate showers' },
        82: { icon: '⛈️', desc: 'Heavy showers' },
        85: { icon: '🌨️', desc: 'Light snow showers' },
        86: { icon: '❄️', desc: 'Heavy snow showers' },
        95: { icon: '⛈️', desc: 'Thunderstorm' },
        96: { icon: '⛈️', desc: 'Thunderstorm with hail' },
        99: { icon: '⛈️', desc: 'Heavy thunderstorm' }
    };
    
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0;">Weather Forecast</h3>
            <div style="font-size:0.9em; color:#64748b;">📍 ${destination}</div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px;">
    `;
    
    // Display up to 7 days
    for (let i = 0; i < Math.min(7, daily.time.length); i++) {
        const date = new Date(daily.time[i]);
        const weatherCode = daily.weathercode[i];
        const weather = weatherCodeMap[weatherCode] || { icon: '🌡️', desc: 'Unknown' };
        const tempMax = Math.round(daily.temperature_2m_max[i]);
        const tempMin = Math.round(daily.temperature_2m_min[i]);
        const precip = daily.precipitation_sum[i];
        
        // Check if this date is within trip dates
        const isInTrip = tripStart && tripEnd && date >= tripStart && date <= tripEnd;
        const borderStyle = isInTrip ? 'border: 2px solid #3b82f6;' : 'border: 1px solid var(--border);';
        
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        html += `
            <div style="${borderStyle} border-radius:8px; padding:12px; background:#fff; text-align:center;">
                <div style="font-weight:600; margin-bottom:4px;">${dayName}</div>
                <div style="font-size:0.85em; color:#64748b; margin-bottom:8px;">${dateStr}</div>
                <div style="font-size:2em; margin:8px 0;">${weather.icon}</div>
                <div style="font-size:0.85em; color:#64748b; margin-bottom:8px;">${weather.desc}</div>
                <div style="font-size:1.5em; font-weight:700; color:#1e293b;">${tempMax}°F</div>
                <div style="font-size:0.85em; color:#94a3b8; margin-top:2px;">Low: ${tempMin}°F</div>
                ${precip > 0 ? `<div style="font-size:0.85em; color:#3b82f6; margin-top:4px;">💧 ${precip.toFixed(1)}"</div>` : ''}
                ${isInTrip ? '<div style="font-size:0.75em; color:#3b82f6; margin-top:4px; font-weight:600;">TRIP DATE</div>' : ''}
            </div>
        `;
    }
    
    html += `
        </div>
        <div style="margin-top:16px; padding:12px; background:#f8fafc; border-radius:8px; font-size:0.85em; color:#64748b;">
            💡 Weather data auto-loaded from flight destination. Data provided by Open-Meteo.<br>
            ${coords ? `📍 Coordinates: ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)} (<a href="https://www.google.com/maps?q=${coords.lat},${coords.lon}" target="_blank" style="color:#3b82f6;">verify location</a>)` : ''}
        </div>
    `;
    
    weatherContent.innerHTML = html;
}

// API Key Management
function saveApiKey() {
    const apiKey = document.getElementById('ticketmasterApiKey').value.trim();
    const statusDiv = document.getElementById('apiKeyStatus');
    
    if (!apiKey) {
        statusDiv.innerHTML = '<p style="color:#dc2626;">❌ Please enter an API key</p>';
        return;
    }
    
    localStorage.setItem('ticketmasterApiKey', apiKey);
    statusDiv.innerHTML = '<p style="color:#10b981;">✅ API Key saved successfully!</p>';
    
    // Reload Things to Do if on map tab
    const mapTab = document.getElementById('mapTab');
    if (mapTab && mapTab.classList.contains('active')) {
        loadThingsToDo();
    }
}

function loadApiKey() {
    const apiKey = localStorage.getItem('ticketmasterApiKey');
    if (apiKey) {
        document.getElementById('ticketmasterApiKey').value = apiKey;
    }
}

// Display Things to Do with Live Events
function displayThingsToDoWithEvents(cityName, cityData, events) {
    const liveEventsSection = document.getElementById('liveEventsSection');
    if (!liveEventsSection) return;
    
    let eventsHtml = '<strong style="font-size:0.95em;">🎫 Live Events</strong>';
    
    events.slice(0, 5).forEach(event => {
        const eventDate = new Date(event.dates.start.localDate);
        const dateStr = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const venue = event._embedded && event._embedded.venues ? event._embedded.venues[0].name : 'Venue TBA';
        const category = event.classifications && event.classifications[0] ? event.classifications[0].segment.name : 'Event';
        
        eventsHtml += `
            <div style="margin:8px 0; padding:8px; background:#f0fdf4; border-radius:6px; border-left:3px solid #10b981;">
                <div style="font-weight:600; font-size:0.9em;">🎟️ ${event.name}</div>
                <div style="color:#64748b; font-size:0.85em;">${dateStr} • ${venue}</div>
                <div style="color:#64748b; font-size:0.8em; margin-top:2px;">${category}</div>
                ${event.url ? `<a href="${event.url}" target="_blank" rel="noopener noreferrer" style="color:#10b981; font-size:0.8em; text-decoration:none;">🎫 Get Tickets →</a>` : ''}
            </div>
        `;
    });
    
    if (events.length === 0) {
        eventsHtml += '<div style="padding:8px; color:#64748b; font-size:0.85em;">No events found for your dates</div>';
    }
    
    liveEventsSection.innerHTML = eventsHtml;
}

// Fetch Live Events from Ticketmaster
async function fetchLiveEvents(city, startDate, endDate) {
    const apiKey = localStorage.getItem('ticketmasterApiKey');
    
    if (!apiKey) {
        console.log('No Ticketmaster API key configured');
        return null;
    }
    
    try {
        // Format dates for API (YYYY-MM-DDTHH:mm:ssZ)
        const start = startDate ? new Date(startDate).toISOString().split('.')[0] + 'Z' : new Date().toISOString().split('.')[0] + 'Z';
        const end = endDate ? new Date(endDate).toISOString().split('.')[0] + 'Z' : null;
        
        let url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${apiKey}&city=${encodeURIComponent(city)}&size=10&sort=date,asc`;
        
        if (start) {
            url += `&startDateTime=${start}`;
        }
        if (end) {
            url += `&endDateTime=${end}`;
        }
        
        console.log('🎫 Fetching events from Ticketmaster for:', city);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data._embedded && data._embedded.events) {
            console.log(`✅ Found ${data._embedded.events.length} live events`);
            return data._embedded.events;
        } else {
            console.log('No events found for this destination/dates');
            return [];
        }
    } catch (error) {
        console.error('Error fetching Ticketmaster events:', error);
        return null;
    }
}

// Search Events
function searchEvents() {
    const searchTerm = document.getElementById('searchEvents').value.toLowerCase();
    const trip = getCurrentTrip();
    
    if (!trip || !searchTerm) {
        displayItinerary();
        return;
    }
    
    // Filter events based on search term
    const filteredEvents = trip.events.filter(event => 
        event.title.toLowerCase().includes(searchTerm) ||
        event.description.toLowerCase().includes(searchTerm) ||
        event.location.toLowerCase().includes(searchTerm)
    );
    
    // Display filtered results (simplified version)
    console.log('Search results:', filteredEvents);
}

// Quick Stats
function updateQuickStats() {
    const trip = getCurrentTrip();
    const statsEl = document.getElementById('quickStats');
    
    if (!trip) {
        statsEl.innerHTML = '';
        return;
    }
    
    const eventsCount = trip.events ? trip.events.length : 0;
    const daysUntil = Math.ceil((new Date(trip.startDate) - new Date()) / (1000 * 60 * 60 * 24));
    
    statsEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-number">${eventsCount}</div>
            <div class="stat-label">Events</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">${daysUntil}</div>
            <div class="stat-label">Days Until</div>
        </div>
    `;
}

// Export Functions
function exportItinerary() {
    const trip = getCurrentTrip();
    if (!trip) {
        alert('No trip selected');
        return;
    }
    
    const data = JSON.stringify(trip, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trip.name.replace(/\s+/g, '_')}_itinerary.json`;
    a.click();
}

function importCalendar() {
    const trip = getCurrentTrip();
    if (!trip) {
        alert('Please select a trip first');
        return;
    }
    
    const calendarData = document.getElementById('importData').value;
    if (!calendarData) {
        alert('Please paste your calendar data');
        return;
    }
    
    try {
        const events = parseICS(calendarData);
        
        if (events.length === 0) {
            alert('No events found in the calendar data');
            return;
        }
        
        // Add all parsed events to the trip
        events.forEach(event => {
            trip.events.push(event);
        });
        
        localStorage.setItem('trips', JSON.stringify(trips));
        displayItinerary();
        closeModal('importModal');
        
        alert(`Successfully imported ${events.length} event(s)!`);
        
        // Clear the import field
        document.getElementById('importData').value = '';
    } catch (error) {
        alert('Error parsing calendar data: ' + error.message);
    }
}

// ICS Parser Functions
function parseICS(icsData) {
    const events = [];
    const lines = icsData.split(/\r?\n/);
    let currentEvent = null;
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Handle line folding (lines that start with space or tab)
        while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
            line += lines[i + 1].substring(1);
            i++;
        }
        
        if (line.startsWith('BEGIN:VEVENT')) {
            currentEvent = {
                id: Date.now().toString() + Math.random(),
                type: 'personal'
            };
        } else if (line.startsWith('END:VEVENT') && currentEvent) {
            // Convert to our event format
            if (currentEvent.start) {
                const event = {
                    id: currentEvent.id,
                    type: currentEvent.type,
                    title: currentEvent.title || 'Untitled Event',
                    date: currentEvent.start.toISOString().split('T')[0],
                    startTime: formatTimeForInput(currentEvent.start),
                    endTime: currentEvent.end ? formatTimeForInput(currentEvent.end) : '',
                    location: currentEvent.location || '',
                    description: currentEvent.description || ''
                };
                events.push(event);
            }
            currentEvent = null;
        } else if (currentEvent) {
            const colonIndex = line.indexOf(':');
            if (colonIndex > -1) {
                const key = line.substring(0, colonIndex).split(';')[0];
                const value = line.substring(colonIndex + 1);
                
                switch(key) {
                    case 'SUMMARY':
                        currentEvent.title = value;
                        break;
                    case 'LOCATION':
                        currentEvent.location = value;
                        break;
                    case 'DESCRIPTION':
                        currentEvent.description = value.replace(/\\n/g, '\n');
                        break;
                    case 'DTSTART':
                        currentEvent.start = parseICSDate(value);
                        break;
                    case 'DTEND':
                        currentEvent.end = parseICSDate(value);
                        break;
                }
            }
        }
    }
    
    return events.sort((a, b) => new Date(a.date + ' ' + a.startTime) - new Date(b.date + ' ' + b.startTime));
}

function parseICSDate(dateString) {
    // Handle different date formats
    if (dateString.includes('T')) {
        // YYYYMMDDTHHMMSS format
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        const hour = dateString.substring(9, 11);
        const minute = dateString.substring(11, 13);
        const second = dateString.substring(13, 15);
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
    } else {
        // YYYYMMDD all-day event
        const year = dateString.substring(0, 4);
        const month = dateString.substring(4, 6);
        const day = dateString.substring(6, 8);
        return new Date(`${year}-${month}-${day}`);
    }
}

function formatTimeForInput(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function loadSampleTrip() {
    // Create a sample trip
    const trip = {
        id: Date.now().toString(),
        name: 'Paris & Rome Adventure',
        destination: 'Paris, France & Rome, Italy',
        startDate: '2025-03-15',
        endDate: '2025-03-21',
        events: [],
        created: new Date().toISOString(),
        archived: false
    };
    
    const sampleICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Sample Trip//EN
BEGIN:VEVENT
SUMMARY:Flight to Paris
LOCATION:JFK Airport Terminal 4
DESCRIPTION:Air France AF007\\nDeparture: 10:30 PM\\nArrival: 11:45 AM (next day)\\nConfirmation: ABC123
DTSTART:20250315T223000
DTEND:20250316T114500
END:VEVENT
BEGIN:VEVENT
SUMMARY:Check-in Hotel Marais
LOCATION:Hotel Marais, 3 Rue de Turenne, Paris
DESCRIPTION:Boutique hotel in the heart of Le Marais\\nConfirmation: HTL456789
DTSTART:20250316T140000
DTEND:20250316T150000
END:VEVENT
BEGIN:VEVENT
SUMMARY:Eiffel Tower Visit
LOCATION:Champ de Mars, 5 Avenue Anatole France, Paris
DESCRIPTION:Skip-the-line tickets\\nSunset viewing from top level
DTSTART:20250316T180000
DTEND:20250316T210000
END:VEVENT
BEGIN:VEVENT
SUMMARY:Louvre Museum Tour
LOCATION:Rue de Rivoli, 75001 Paris
DESCRIPTION:Private guided tour\\nFocus on Renaissance art and Mona Lisa
DTSTART:20250317T100000
DTEND:20250317T130000
END:VEVENT
BEGIN:VEVENT
SUMMARY:Seine River Cruise
LOCATION:Port de la Bourdonnais, Paris
DESCRIPTION:Dinner cruise with live music\\nDress code: Smart casual
DTSTART:20250317T190000
DTEND:20250317T220000
END:VEVENT
BEGIN:VEVENT
SUMMARY:Train to Rome
LOCATION:Gare de Lyon, Paris
DESCRIPTION:TGV to Milan, then Frecciarossa to Rome\\nFirst class tickets
DTSTART:20250318T080000
DTEND:20250318T190000
END:VEVENT
BEGIN:VEVENT
SUMMARY:Vatican Museums & Sistine Chapel
LOCATION:Viale Vaticano, 00165 Rome
DESCRIPTION:Early access tour\\nSkip the lines\\nGuide: Maria
DTSTART:20250319T083000
DTEND:20250319T123000
END:VEVENT
BEGIN:VEVENT
SUMMARY:Colosseum & Roman Forum
LOCATION:Piazza del Colosseo, 1, 00184 Rome
DESCRIPTION:Underground and arena floor access\\nAncient Rome walking tour
DTSTART:20250319T140000
DTEND:20250319T170000
END:VEVENT
BEGIN:VEVENT
SUMMARY:Cooking Class
LOCATION:Via dei Cappuccini 6, Rome
DESCRIPTION:Learn to make authentic pasta and tiramisu\\nIncludes dinner and wine
DTSTART:20250320T170000
DTEND:20250320T210000
END:VEVENT
BEGIN:VEVENT
SUMMARY:Flight Home
LOCATION:Leonardo da Vinci Airport (FCO)
DESCRIPTION:Delta DL247\\nDeparture: 2:30 PM\\nArrival: 6:45 PM (same day)
DTSTART:20250321T143000
DTEND:20250321T184500
END:VEVENT
END:VCALENDAR`;
    
    trip.events = parseICS(sampleICS);
    
    trips.push(trip);
    localStorage.setItem('trips', JSON.stringify(trips));
    
    // Initialize storage for this trip
    packingItems[trip.id] = [
        { name: 'Passport', checked: false },
        { name: 'Flight tickets', checked: false },
        { name: 'Hotel confirmations', checked: false },
        { name: 'Camera', checked: false },
        { name: 'Chargers', checked: false }
    ];
    budgetItems[trip.id] = [];
    receipts[trip.id] = [];
    documents[trip.id] = [];
    agendas[trip.id] = { url: '', text: '' };
    
    localStorage.setItem('packingItems', JSON.stringify(packingItems));
    localStorage.setItem('budgetItems', JSON.stringify(budgetItems));
    localStorage.setItem('receipts', JSON.stringify(receipts));
    localStorage.setItem('documents', JSON.stringify(documents));
    localStorage.setItem('agendas', JSON.stringify(agendas));
    
    loadTrips();
    selectTrip(trip.id);
    
    alert('Sample trip loaded! Check out the itinerary.');
}

// Conference Functions
function handleConferenceFile(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        alert(`Conference file uploaded: ${file.name}\nParsing feature to be implemented`);
    }
}

function findMyEvents() {
    const trackName = document.getElementById('trackName').value;
    if (!trackName) {
        alert('Please enter a name to track');
        return;
    }
    alert(`Finding events for: ${trackName}\nFeature to be implemented`);
}

// Document Management
function handleDocumentUpload(input) {
    if (input.files && input.files.length > 0) {
        alert(`${input.files.length} document(s) uploaded\nFeature to be implemented`);
    }
}

// Utility Functions
function formatDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// Initialize the app when page loads
window.addEventListener('DOMContentLoaded', initApp);
