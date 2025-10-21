# 🌍 Trip & Conference Manager

A comprehensive web application for managing travel itineraries, conferences, packing lists, budgets, and more!

## 📁 Files Overview

### Main Application (Multi-Trip Manager)
- **`index.html`** - Main HTML structure with tabs and modals
- **`styles.css`** - Complete styling with animations and responsive design
- **`app.js`** - JavaScript functionality with LocalStorage persistence

### Additional Files
- **`original-simple-version.html`** - Single-page simple trip generator (your original version)

## ✨ Features

### Multi-Trip Management
- ✅ Create and manage multiple trips
- ✅ Switch between trips easily
- ✅ Persistent storage using LocalStorage
- ✅ Quick stats for each trip

### Itinerary Builder
- ✅ Add events manually
- ✅ **Import from .ics calendar files** (Google Calendar, Outlook, Apple Calendar)
- ✅ Organize events by day
- ✅ Different event types (Personal, Conference, Flight, Hotel, Meeting)
- ✅ Time-based scheduling
- ✅ Export itinerary to JSON

### Conference Features
- 📄 Upload conference programs
- 🔍 Track specific sessions
- 📋 Personal event highlighting

### Packing Checklist
- ✅ Add packing items
- ✅ Check off items as packed
- ✅ Persistent across sessions

### Budget Tracker
- 💰 Track expenses by category
- 📊 Automatic total calculation
- 📝 Detailed expense descriptions

### Additional Tabs
- ☀️ Weather widget (placeholder for API integration)
- 🗺️ Map view (placeholder for Google Maps integration)
- 📄 Document management

## 🚀 Getting Started

### Quick Start
1. Open `index.html` in your web browser
2. Click **"📋 Load Sample Trip"** to see example data
3. Explore the tabs: Itinerary, Conference, Packing, Budget, etc.

### Creating Your First Trip
1. Click **"+ New Trip"**
2. Fill in trip details:
   - Trip Name (e.g., "AAHKS Conference 2025")
   - Destination (e.g., "Dallas, TX")
   - Start and End Dates
3. Click **"Create Trip"**

### Importing Calendar Events
1. Select a trip from the sidebar
2. Go to **"📅 Itinerary"** tab
3. Click **"📥 Import Calendar"**
4. Paste your .ics file content
5. Click **"Import"**

#### How to Get .ics Files:
- **Google Calendar:** Settings → Import & Export → Export
- **Outlook:** File → Save Calendar → iCalendar Format (.ics)
- **Apple Calendar:** File → Export → Export

### Adding Events Manually
1. Click **"+ Add Event"**
2. Fill in event details:
   - Event Type
   - Title
   - Date and Time
   - Location
   - Description
3. Click **"Add Event"**

## 📦 Data Storage

All data is stored in your browser's LocalStorage:
- **trips** - All trip information and events
- **packingItems** - Packing lists per trip
- **budgetItems** - Budget entries per trip
- **documents** - Document references per trip
- **currentTripId** - Currently selected trip

### Export Your Data
Click **"📤 Export"** in the Itinerary tab to download trip data as JSON.

## 🎨 Features Comparison

| Feature | Multi-Trip Manager | Simple Version |
|---------|-------------------|----------------|
| Multiple Trips | ✅ | ❌ |
| ICS Import | ✅ | ✅ |
| Persistent Storage | ✅ | ❌ |
| Packing Lists | ✅ | ❌ |
| Budget Tracking | ✅ | ❌ |
| Conference Tools | ✅ | ❌ |
| Manual Event Entry | ✅ | ❌ |
| Export/Print | ✅ | ✅ |

## 🔧 Customization

### Adding New Event Types
Edit `app.js` and update the event type dropdown in `index.html`:
```javascript
<option value="custom">Custom Type</option>
```

### Styling
Modify CSS variables in `styles.css`:
```css
:root {
    --primary: #6366f1;
    --secondary: #8b5cf6;
    --success: #10b981;
    /* etc... */
}
```

## 🌟 Sample Trip

The app includes a pre-built sample trip: **"Paris & Rome Adventure"**

Includes:
- 10 events over 7 days
- Flights, hotels, tours, activities
- Full itinerary with locations and descriptions
- Sample packing list

Click **"📋 Load Sample Trip"** to try it!

## 🛠️ Future Enhancements

Potential features to add:
- [ ] Weather API integration
- [ ] Google Maps integration
- [ ] PDF export with custom templates
- [ ] Conference program PDF parsing (OCR)
- [ ] Collaborative trip planning
- [ ] Mobile app version
- [ ] Cloud sync (Firebase/Supabase)
- [ ] Travel time calculations
- [ ] Currency conversion for budgets
- [ ] Photo gallery per trip

## 📱 Mobile Responsive

The app is fully responsive and works on:
- 💻 Desktop
- 📱 Tablets
- 📱 Mobile phones

## 🐛 Troubleshooting

### Events Not Showing
- Make sure you've selected a trip from the sidebar
- Check that events have valid dates

### Import Not Working
- Verify your .ics file format
- Make sure it contains `BEGIN:VEVENT` entries
- Try the sample trip first to test

### Data Lost
- Data is stored in LocalStorage (browser-specific)
- Clearing browser data will delete trips
- Use Export feature regularly to backup

## 💡 Tips

1. **Use descriptive trip names** - Makes it easier to find trips later
2. **Export regularly** - Backup your trip data
3. **Add all events first** - Then organize packing and budget
4. **Use event types** - Helps visually organize your itinerary
5. **Try the sample trip** - Great way to learn the features

## 📄 License

Free to use and modify for personal or commercial projects.

---

**Enjoy planning your trips!** 🎉✈️🗺️
