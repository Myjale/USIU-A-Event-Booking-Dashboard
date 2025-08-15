(function(){
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const now = new Date();
  const daysFromNow = d => {
    const t = new Date(now);
    t.setDate(t.getDate() + d);
    t.setMinutes(0,0,0);
    return t;
  };

  const SAMPLE_EVENTS = [
    { id: 'E001', title: 'Varsity Football Final', category: 'Sports', location: 'Main Field', datetime: daysFromNow(1).toISOString(), capacity: 120, booked: 0, details: 'Championship match. Wear school colors!' },
    { id: 'E002', title: 'Cultural Night', category: 'Culture', location: 'Auditorium', datetime: daysFromNow(3).toISOString(), capacity: 200, booked: 0, details: 'Food, dance, music from around the world.' },
    { id: 'E003', title: 'Tech Career Fair', category: 'Career', location: 'Innovation Hub', datetime: daysFromNow(5).toISOString(), capacity: 150, booked: 0, details: 'Meet recruiters, resume reviews, mock interviews.' },
    { id: 'E004', title: 'Research Colloquium', category: 'Academics', location: 'Lecture Hall B', datetime: daysFromNow(2).toISOString(), capacity: 90, booked: 0, details: 'Faculty and grad students present latest work.' },
    { id: 'E005', title: 'Basketball 3v3', category: 'Sports', location: 'Sports Complex', datetime: daysFromNow(7).toISOString(), capacity: 80, booked: 0, details: 'Casual tournament. Teams register on site.' }
  ];

  const LS = {
    get(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
    set(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
  };

  const state = {
    events: LS.get('usiu.events', null),
    bookings: LS.get('usiu.bookings', []),
    filters: { q: '', cat: 'all', sort: 'dateAsc' },
    editingId: null
  };

  function ensureEvents(){
    if(!state.events || !Array.isArray(state.events) || state.events.length === 0){
      state.events = SAMPLE_EVENTS;
      LS.set('usiu.events', state.events);
    }
  }

  function sumSeatsLeft(){
    return state.events.reduce((acc,e)=> acc + Math.max(0, e.capacity - e.booked), 0);
  }

  function upcomingCount(){
    const now = Date.now();
    return state.events.filter(e => new Date(e.datetime).getTime() >= now).length;
  }

  function formatDate(iso){
    const d = new Date(iso);
    return d.toLocaleString([], { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
  }

  function renderStats(){
    $('#statTotalBookings').textContent = state.bookings.length;
    $('#statUpcoming').textContent = upcomingCount();
    $('#statSeatsLeft').textContent = sumSeatsLeft();
  }

  function matchesFilters(e){
    const q = state.filters.q.trim().toLowerCase();
    const cat = state.filters.cat;
    const inCat = cat === 'all' || e.category === cat;
    const inText = !q || (e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
    return inCat && inText;
  }

  function sortEvents(list){
    const s = state.filters.sort;
    const bySeats = ev => Math.max(0, ev.capacity - ev.booked);
    if(s === 'dateAsc') return list.sort((a,b)=> new Date(a.datetime)-new Date(b.datetime));
    if(s === 'dateDesc') return list.sort((a,b)=> new Date(b.datetime)-new Date(a.datetime));
    if(s === 'seatsDesc') return list.sort((a,b)=> bySeats(b) - bySeats(a));
    if(s === 'seatsAsc') return list.sort((a,b)=> bySeats(a) - bySeats(b));
    if(s === 'titleAsc') return list.sort((a,b)=> a.title.localeCompare(b.title));
    if(s === 'titleDesc') return list.sort((a,b)=> b.title.localeCompare(a.title));
    return list;
  }

  function renderEvents(){
    const grid = $('#eventsGrid');
    grid.innerHTML = '';
    let list = state.events.filter(matchesFilters);
    list = sortEvents(list);
    if(list.length === 0){
      $('#eventsEmpty').classList.remove('hidden');
      return;
    } else {
      $('#eventsEmpty').classList.add('hidden');
    }
    const tmpl = $('#eventCardTmpl');
    list.forEach(ev => {
      const node = tmpl.content.cloneNode(true);
      const card = node.querySelector('.card');
      card.dataset.id = ev.id;
      card.querySelector('.card-title').textContent = ev.title;
      card.querySelector('.badge').textContent = ev.category;
      card.querySelector('.subtitle').textContent = ev.details;
      card.querySelector('.location').textContent = `📍 ${ev.location}`;
      const left = Math.max(0, ev.capacity - ev.booked);
      const pct = Math.round((ev.booked/ev.capacity)*100);
      const bar = card.querySelector('.bar');
      bar.style.width = Math.min(100, 100 - Math.round((left/ev.capacity)*100)) + '%';
      card.querySelector('.seats').textContent = `${left} / ${ev.capacity} seats left`;
      card.querySelector('.date').textContent = formatDate(ev.datetime);
      const bookBtn = card.querySelector('.bookBtn');
      const detailsBtn = card.querySelector('.detailsBtn');
      bookBtn.disabled = left === 0;
      bookBtn.textContent = left === 0 ? 'Full' : 'Book';
      bookBtn.addEventListener('click', ()=> openBooking(ev.id));
      detailsBtn.addEventListener('click', ()=> alert(`${ev.title}\n${formatDate(ev.datetime)}\n${ev.location}\n\n${ev.details}`));
      grid.appendChild(node);
    });
  }

  function renderBookings(){
    const body = $('#bookingsBody');
    body.innerHTML = '';
    if(state.bookings.length === 0){
      $('#bookingsEmpty').classList.remove('hidden');
    } else {
      $('#bookingsEmpty').classList.add('hidden');
    }
    state.bookings.forEach((b, idx) => {
      const tr = document.createElement('tr');
      const ev = state.events.find(e=> e.id === b.eventId);
      tr.innerHTML = `
        <td>${ev?.title ?? b.eventId}</td>
        <td>${formatDate(ev?.datetime ?? b.date)}</td>
        <td>${b.studentId}</td>
        <td>${b.studentName}</td>
        <td>${b.seats}</td>
        <td>
          <button data-act="edit" data-idx="${idx}">Edit</button>
          <button class="secondary" data-act="delete" data-idx="${idx}">Cancel</button>
        </td>`;
      body.appendChild(tr);
    });
  }

  function openBooking(eventId){
    state.editingId = null;
    $('#dialogTitle').textContent = 'Book Event';
    $('#eventId').value = eventId;
    $('#studentId').value = '';
    $('#studentName').value = '';
    $('#seats').value = 1;
    $('#bookingDialog').showModal();
  }

  function openEditBooking(index){
    const b = state.bookings[index];
    state.editingId = index;
    const ev = state.events.find(e=> e.id === b.eventId);
    $('#dialogTitle').textContent = 'Edit Booking';
    $('#eventId').value = b.eventId;
    $('#studentId').value = b.studentId;
    $('#studentName').value = b.studentName;
    $('#seats').value = b.seats;
    $('#bookingDialog').showModal();
  }

  function saveBooking(e){
    e.preventDefault();
    const eventId = $('#eventId').value;
    const studentId = $('#studentId').value.trim();
    const studentName = $('#studentName').value.trim();
    const seats = parseInt($('#seats').value,10);

    if(!studentId || !studentName || !Number.isInteger(seats) || seats < 1){
      alert('Please provide valid booking details.');
      return;
    }

    const ev = state.events.find(ev => ev.id === eventId);
    if(!ev){ alert('Event not found.'); return; }

    const existingIdx = state.bookings.findIndex(b => b.eventId === eventId && b.studentId === studentId);
    if(existingIdx !== -1 && existingIdx !== state.editingId){
      alert('This student already has a booking for this event.');
      return;
    }

    const seatsLeft = Math.max(0, ev.capacity - ev.booked);
    let requested = seats;
    if(state.editingId !== null){
      const old = state.bookings[state.editingId];
      ev.booked -= old.seats;
    }
    if(requested > Math.max(0, ev.capacity - ev.booked)){
      alert('Not enough seats left.');
      if(state.editingId !== null){ ev.booked += state.bookings[state.editingId].seats; }
      return;
    }

    if(state.editingId !== null){
      state.bookings[state.editingId] = { eventId, studentId, studentName, seats: requested, ts: Date.now() };
      ev.booked += requested;
    }else{
      state.bookings.push({ eventId, studentId, studentName, seats: requested, ts: Date.now() });
      ev.booked += requested;
    }

    LS.set('usiu.bookings', state.bookings);
    LS.set('usiu.events', state.events);
    renderStats();
    renderEvents();
    renderBookings();
    $('#bookingDialog').close();
  }

  function deleteBooking(index){
    const b = state.bookings[index];
    const ev = state.events.find(e=> e.id === b.eventId);
    if(ev){ ev.booked = Math.max(0, ev.booked - b.seats); }
    state.bookings.splice(index,1);
    LS.set('usiu.bookings', state.bookings);
    LS.set('usiu.events', state.events);
    renderStats();
    renderEvents();
    renderBookings();
  }

  function attachHandlers(){
    $('#search').addEventListener('input', e=>{ state.filters.q = e.target.value; renderEvents(); });
    $('#filterCategory').addEventListener('change', e=>{ state.filters.cat = e.target.value; renderEvents(); });
    $('#sortBy').addEventListener('change', e=>{ state.filters.sort = e.target.value; renderEvents(); });

    $('#addSampleData').addEventListener('click', ()=>{
      if(confirm('Reset events and bookings to sample data?')){
        LS.set('usiu.bookings', []);
        LS.set('usiu.events', SAMPLE_EVENTS);
        state.bookings = [];
        state.events = JSON.parse(JSON.stringify(SAMPLE_EVENTS));
        renderStats(); renderEvents(); renderBookings();
      }
    });

    $('#exportData').addEventListener('click', ()=>{
      const data = { events: state.events, bookings: state.bookings };
      const blob = new Blob([JSON.stringify(data,null,2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'usiu_event_booking_export.json'; a.click();
      setTimeout(()=> URL.revokeObjectURL(url), 1000);
    });

    $('#importData').addEventListener('change', e=>{
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if(!data.events || !data.bookings) throw new Error('Invalid file');
          state.events = data.events; state.bookings = data.bookings;
          LS.set('usiu.events', state.events); LS.set('usiu.bookings', state.bookings);
          renderStats(); renderEvents(); renderBookings();
        } catch(err){
          alert('Import failed: ' + err.message);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    $('#bookingForm').addEventListener('submit', saveBooking);
    $('#cancelDialog').addEventListener('click', ()=> $('#bookingDialog').close());

    $('#bookingsBody').addEventListener('click', e=>{
      const btn = e.target.closest('button'); if(!btn) return;
      const idx = parseInt(btn.dataset.idx,10);
      const act = btn.dataset.act;
      if(act === 'edit'){ openEditBooking(idx); }
      if(act === 'delete' && confirm('Cancel this booking?')){ deleteBooking(idx); }
    });
  }

  function init(){
    ensureEvents();
    renderStats();
    renderEvents();
    renderBookings();
    attachHandlers();
  }

  document.addEventListener('DOMContentLoaded', init);
})();