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
    
    // Map destinations to landmark search terms for Unsplash
    const landmarks = {
        'paris': 'eiffel+tower+paris',
        'rome': 'colosseum+rome',
        'tokyo': 'tokyo+tower',
        'new york': 'statue+of+liberty',
        'london': 'big+ben+london',
        'dallas': 'dallas+skyline',
        'texas': 'texas+flag+lone+star',
        'california': 'golden+gate+bridge',
        'miami': 'miami+beach+ocean',
        'chicago': 'chicago+skyline',
        'seattle': 'space+needle',
        'boston': 'boston+harbor',
        'las vegas': 'las+vegas+strip',
        'san francisco': 'golden+gate+bridge',
        'los angeles': 'hollywood+sign',
        'washington': 'washington+monument',
        'barcelona': 'sagrada+familia',
        'amsterdam': 'amsterdam+canal',
        'berlin': 'brandenburg+gate',
        'dubai': 'burj+khalifa',
    };
    
    // Fallback gradients - SET IMMEDIATELY for instant feedback
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
        'default': 'linear-gradient(135deg, #eaf1e6 0%, #f0f5f0 100%)',
    };
    
    const dest = (trip.destination || '').toLowerCase();
    const gradientKey = Object.keys(gradients).find(k => dest.includes(k));
    const gradient = gradients[gradientKey] || gradients['default'];
    
    // Set gradient immediately for instant feedback
    body.style.background = gradient;
    console.log('Background gradient set for:', trip.destination, 'key:', gradientKey || 'default');
    
    // Try to load landmark image if available - using WikiMedia Commons (actual landmarks!)
    const landmarkKey = Object.keys(landmarks).find(k => dest.includes(k));
    if (landmarkKey) {
        // Direct URLs to actual landmark photos from WikiMedia Commons
        const landmarkImages = {
            'paris': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/1920px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg',
            'rome': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Colosseo_2020.jpg/1920px-Colosseo_2020.jpg',
            'tokyo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Tokyo_Tower_2023.jpg/1920px-Tokyo_Tower_2023.jpg',
            'new york': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Lady_Liberty_under_a_blue_sky_%28cropped%29.jpg/1920px-Lady_Liberty_under_a_blue_sky_%28cropped%29.jpg',
            'london': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Clock_Tower_-_Palace_of_Westminster%2C_London_-_May_2007.jpg/1920px-Clock_Tower_-_Palace_of_Westminster%2C_London_-_May_2007.jpg',
            'dallas': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Dallas_skyline_daytime.jpg/1920px-Dallas_skyline_daytime.jpg',
            'texas': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Flag_of_Texas.svg/1920px-Flag_of_Texas.svg.png',
            'california': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/GoldenGateBridge-001.jpg/1920px-GoldenGateBridge-001.jpg',
            'miami': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Miami_Beach_-_South_Beach_sunset.jpg/1920px-Miami_Beach_-_South_Beach_sunset.jpg',
            'chicago': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Chicago_skyline%2C_viewed_from_John_Hancock_Center.jpg/1920px-Chicago_skyline%2C_viewed_from_John_Hancock_Center.jpg',
            'seattle': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Space_Needle002.jpg/1920px-Space_Needle002.jpg',
            'san francisco': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/GoldenGateBridge-001.jpg/1920px-GoldenGateBridge-001.jpg',
            'washington': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Washington_Monument_Panorama.jpg/1920px-Washington_Monument_Panorama.jpg',
        };
        
        const imgUrl = landmarkImages[landmarkKey];
        if (imgUrl) {
            const img = new Image();
            img.onload = () => {
                body.style.background = `linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.85)), url('${imgUrl}')`;
                body.style.backgroundSize = 'cover';
                body.style.backgroundPosition = 'center';
                body.style.backgroundAttachment = 'fixed';
                console.log('✓ Landmark image loaded for:', trip.destination, 'landmark:', landmarkKey);
            };
            img.onerror = () => {
                console.log('✗ Image failed, keeping gradient for:', trip.destination);
            };
            img.src = imgUrl;
        }
    } else {
        console.log('No landmark match for:', trip.destination);
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
                <button class="btn btn-secondary" style="padding:4px 8px;" onclick="event.stopPropagation(); archiveTrip('${trip.id}')">Archive</button>
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
    const trip = getCurrentTrip();
    if (!trip || !trip.destination) {
        leafletMap.setView([20, 0], 2);
        if (leafletMarker) {
            leafletMarker.remove();
            leafletMarker = null;
        }
        return;
    }
    geocodeDestination(trip.destination).then(coords => {
        if (!coords) {
            leafletMap.setView([20, 0], 2);
            return;
        }
        leafletMap.setView([coords.lat, coords.lon], 12);
        if (leafletMarker) leafletMarker.remove();
        leafletMarker = L.marker([coords.lat, coords.lon]).addTo(leafletMap).bindPopup(trip.destination);
    });
}

function geocodeDestination(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
    return fetch(url, { headers: { 'Accept-Language': 'en' } })
        .then(r => r.json())
        .then(results => {
            if (results && results.length > 0) {
                return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
            }
            return null;
        })
        .catch(() => null);
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
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
