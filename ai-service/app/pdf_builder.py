"""Premium, printable travel-guide PDF builder.

The builder is deliberately data-bound: deterministic trip fields are rendered
as supplied, while Gemini copy is kept in clearly labelled editorial sections.
"""
from io import BytesIO
from html import escape
import os
import requests

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image
)

INK = colors.HexColor('#111827')
MUTED = colors.HexColor('#64748B')
ACCENT = colors.HexColor('#6C63FF')
PALE = colors.HexColor('#F5F7FF')
GREEN = colors.HexColor('#EAF8F0')
ORANGE = colors.HexColor('#FFF5E7')


def _text(value):
    return escape(str(value if value is not None else ''))


def _field(value, name, default=None):
    if isinstance(value, dict):
        return value.get(name, default)
    return getattr(value, name, default)


def _unwrap(value):
    """Accept both the trip JSON contract and provider envelope remnants."""
    if isinstance(value, dict) and value.get('ok') is False:
        return None
    if isinstance(value, dict) and 'data' in value and value.get('ok') is True:
        return value.get('data')
    return value


def _weather_fields(trip):
    raw = _unwrap(_field(trip, 'weather', {})) or {}
    if not isinstance(raw, dict):
        return None, None
    max_temp = next((raw.get(key) for key in ('maxTemp', 'max_temp', 'maxTemperature', 'temperature', 'temperatureMax') if raw.get(key) is not None), None)
    precip = next((raw.get(key) for key in ('precipProb', 'precip_prob', 'precipitationProbability', 'precipitation_probability') if raw.get(key) is not None), None)
    return max_temp, precip


def _is_seasonal_weather(trip):
    """True when the temperature is a climate normal rather than a forecast.

    Open-Meteo only forecasts ~16 days out, so a trip booked months ahead
    carries a climate-model expectation instead. Printing that as a forecast
    in a document the traveller packs from would be a plain misstatement.
    """
    raw = _unwrap(_field(trip, 'weather', {})) or {}
    return isinstance(raw, dict) and raw.get('source') == 'seasonal-normal'


# ReportLab's bundled fonts are the Bitstream Vera family, which predates the
# 2010 rupee sign, so a literal U+20B9 renders as a tofu box (confirmed: the
# BUDGET card printed as "[]23080.2"). Embedding a Unicode TTF would mean
# shipping a font file with the service; spelling the currency is portable
# across the Windows dev box and the Linux deploy and reads the same as the
# generated body copy, which already writes "INR".
def _money(value):
    """Format an amount as `INR 23,080`, or an em dash when there is none."""
    if value is None or value == '':
        return '—'
    try:
        return f"INR {round(float(value)):,}"
    except (TypeError, ValueError):
        return _text(value)


def _hotels(trip):
    raw = _unwrap(_field(trip, 'hotels', None))
    if raw is None:
        raw = _unwrap(_field(trip, 'stays', []))
    if isinstance(raw, dict):
        raw = raw.get('places', raw.get('results', []))
    return [item for item in (raw or []) if isinstance(item, dict) and item.get('name')]


def _itinerary_days(trip):
    raw = _unwrap(_field(trip, 'itinerary', {})) or {}
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        return raw.get('days') or []
    return []


def _grounded_recommendations(request, trip, weather, pressure, route, alerts):
    """Create useful copy from values already computed by Sahyatri.

    This is used only when the LLM brief is empty or returns its old generic
    placeholder. It never invents a number or a named place.
    """
    destination = request.get('destination') or request.get('destName') or request.get('destId') or 'this destination'
    lines = []
    if weather is not None:
        lines.append(f"Plan outdoor sightseeing around the forecast high of {weather} degrees and keep water protection handy if rain is expected.")
    if route and route.get('distanceKm') is not None and route.get('durationMinutes') is not None:
        lines.append(f"The road leg is about {round(float(route['distanceKm']), 1)} km and {round(float(route['durationMinutes']))} minutes, so an early start will leave more daylight at {destination}.")
    if pressure and pressure.get('score') is not None:
        lines.append(f"Crowd pressure is {round(float(pressure['score']) * 100)}%; keep the busiest sights flexible and use the day-wise order as a guide rather than rushing between stops.")
    if alerts:
        first = alerts[0] if isinstance(alerts[0], dict) else {}
        body = first.get('body') or first.get('message')
        if body:
            lines.append(str(body))
    if not lines:
        lines.append(f"Use the verified map stops to explore {destination}; the itinerary is ordered into morning, afternoon, and evening blocks.")
    return lines[:4]


def _packing_items(request, trip, max_temp, precip):
    destination = request.get('destination') or request.get('destName') or request.get('destId') or 'the trip'
    items = [f"Comfortable walking shoes for sightseeing around {destination}", "Sun protection: hat, sunglasses, and sunscreen"]
    if max_temp is not None:
        if float(max_temp) >= 30:
            items.append("Light, breathable clothing for warm daytime conditions")
        elif float(max_temp) <= 20:
            items.append("A light jacket or warm layer for cooler mornings and evenings")
        else:
            items.append("Light layers for changing daytime and evening temperatures")
    if precip is not None and float(precip) >= 30:
        items.append("Compact umbrella or rain shell for the forecast rain risk")
    names = ' '.join(str(entry.get('name', '')) for day in _itinerary_days(trip) for entry in (day.get('stops', []) if isinstance(day, dict) else []) if isinstance(entry, dict)).lower()
    if any(token in names for token in ('waterfall', 'river', 'lake', 'dam', 'island')):
        items.append("Quick-dry clothes and a small towel for riverside or waterfall stops")
    if any(token in names for token in ('trek', 'hill', 'fort', 'museum', 'temple')):
        items.append("Small daypack, refillable water bottle, and footwear with good grip")
    return items


def _safety_items(trip):
    items = []
    alerts = _unwrap(_field(trip, 'alerts', [])) or []
    if isinstance(alerts, dict):
        alerts = alerts.get('alerts', alerts.get('items', []))
    for alert in alerts[:4] if isinstance(alerts, list) else []:
        if isinstance(alert, dict):
            text = alert.get('body') or alert.get('message')
            if text:
                source = alert.get('sourceName') or alert.get('sourceUrl')
                items.append(f"{text}{f' (Source: {source})' if source else ''}")
    road = _unwrap(_field(trip, 'road', {})) or {}
    if isinstance(road, dict) and road.get('corridor'):
        frequency = road.get('frequencyPerDay')
        suffix = f"; listed frequency: {frequency} services/day" if frequency is not None else ''
        items.append(f"Road access follows the {road['corridor']} corridor{suffix}; confirm the return connection before leaving the main sightseeing area.")
    pressure = _unwrap(_field(trip, 'pressure', {})) or {}
    if isinstance(pressure, dict) and pressure.get('degraded'):
        items.append("Some access signals are degraded, so re-check local road and transport conditions before departure.")
    return items


def _image(url, width=76 * mm, height=42 * mm):
    if not url:
        return None
    try:
        if url.startswith('/'):
            url = f"{os.environ.get('BACKEND_URL', 'http://localhost:5001')}{url}"
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        image = Image(BytesIO(response.content), width=width, height=height)
        image.hAlign = 'LEFT'
        return image
    except Exception:
        return None


def _qr(value, size=24 * mm):
    widget = qr.QrCodeWidget(value)
    bounds = widget.getBounds()
    drawing = Drawing(size, size, transform=[size / (bounds[2] - bounds[0]), 0, 0, size / (bounds[3] - bounds[1]), 0, 0])
    drawing.add(widget)
    return drawing


def _card(title, value, tone=PALE):
    return Table([[Paragraph(f'<b>{_text(title)}</b><br/><font size="15" color="#111827">{_text(value)}</font>', CARD) ]], colWidths=[55 * mm], rowHeights=[22 * mm], style=TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), tone), ('BOX', (0, 0), (-1, -1), .5, colors.HexColor('#E2E8F0')),
        ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))


styles = getSampleStyleSheet()
TITLE = ParagraphStyle('GuideTitle', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=27, leading=31, textColor=INK, spaceAfter=8)
H1 = ParagraphStyle('GuideH1', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=19, leading=23, textColor=INK, spaceBefore=3, spaceAfter=10)
H2 = ParagraphStyle('GuideH2', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=ACCENT, spaceBefore=6, spaceAfter=5)
BODY = ParagraphStyle('GuideBody', parent=styles['BodyText'], fontName='Helvetica', fontSize=9.5, leading=14, textColor=colors.HexColor('#334155'))
SMALL = ParagraphStyle('GuideSmall', parent=BODY, fontSize=8, leading=11, textColor=MUTED)
CARD = ParagraphStyle('GuideCard', parent=BODY, fontSize=8.5, leading=12, textColor=MUTED)
REMINDER = ParagraphStyle('GuideReminder', parent=BODY, fontSize=10, leading=14, textColor=INK)


def build_travel_brief_pdf(brief, request, trip):
    output = BytesIO()
    doc = BaseDocTemplate(output, pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm, topMargin=15 * mm, bottomMargin=15 * mm, title=brief.title, author='Sahyatri AI')
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='guide')

    def footer(canvas, document):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor('#E2E8F0')); canvas.line(16 * mm, 11 * mm, 194 * mm, 11 * mm)
        canvas.setFont('Helvetica', 7); canvas.setFillColor(MUTED)
        canvas.drawString(16 * mm, 7 * mm, 'SAHYATRI AI  ·  YOUR TRIP, INTELLIGENTLY MAPPED')
        canvas.drawRightString(194 * mm, 7 * mm, f'{document.page}')
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id='guide', frames=frame, onPage=footer)])
    destination = request.get('destination') or request.get('destName') or request.get('destId') or 'Your destination'
    dates = f"{request.get('startDate', '')} - {request.get('endDate', '')}"
    travellers = request.get('travellers', 1)
    days = _itinerary_days(trip)
    hotels = _hotels(trip)
    max_temp, precip_prob = _weather_fields(trip)
    pressure = _unwrap(_field(trip, 'pressure', {})) or {}
    route = _unwrap(_field(trip, 'route', {})) or {}
    alerts = _unwrap(_field(trip, 'alerts', [])) or []
    budget = (trip.get('costBreakdown') or {}).get('grandTotal') or request.get('budgetINR') or request.get('budgetInr') or '—'
    hero = _image(hotels[0].get('photoUrl') if hotels and isinstance(hotels[0], dict) else None, 178 * mm, 65 * mm)

    story = []
    if hero: story.extend([hero, Spacer(1, 8)])
    story.extend([Paragraph('AI TRAVEL GUIDE', H2), Paragraph(_text(destination), TITLE), Paragraph(f'{_text(dates)}  ·  {_text(travellers)} traveller(s)', BODY), Spacer(1, 7), Paragraph('Generated by Sahyatri AI', SMALL), Spacer(1, 12)])
    weather_card = f"{_text(max_temp)}°" if max_temp is not None else 'Unavailable'
    # Name what each number means. "70%" alone does not say 70% of what, and a
    # climate normal presented bare reads as a forecast for that exact date.
    weather_label = 'WEATHER (SEASONAL AVG)' if _is_seasonal_weather(trip) else 'WEATHER (FORECAST)'
    pressure_card = f"{round(float(pressure.get('score', 0)) * 100)}% crowded" if pressure.get('score') is not None else 'Unavailable'
    story.append(Table([[_card(weather_label, weather_card), _card('PRESSURE', pressure_card, GREEN), _card('EST. TOTAL COST', _money(budget), ORANGE)]], colWidths=[59 * mm] * 3, style=TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 5)])))
    story.extend([Spacer(1, 12), Paragraph('A polished guide for a calmer, more intentional trip.', BODY), PageBreak()])

    story.extend([Paragraph('Executive summary', H1), Paragraph(_text(brief.summary), BODY), Spacer(1, 5), Paragraph(_text(brief.explanation), BODY), Spacer(1, 14), Paragraph('Things AI wants you to remember', H2)])
    reminders = brief.thingsToRemember or brief.weatherAdvice or brief.safetyTips or []
    if reminders:
        reminder_rows = [[Paragraph(f'<font color="#6C63FF">✓</font>  {_text(item)}', REMINDER)] for item in reminders[:8]]
        story.append(Table(reminder_rows, colWidths=[178 * mm], style=TableStyle([('BACKGROUND', (0, 0), (-1, -1), PALE), ('BOX', (0, 0), (-1, -1), .5, colors.HexColor('#DDE2FF')), ('INNERGRID', (0, 0), (-1, -1), .25, colors.white), ('LEFTPADDING', (0, 0), (-1, -1), 10), ('RIGHTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)])))
    else: story.append(Paragraph('No time-sensitive reminders were returned for this trip.', SMALL))
    brief_recommendations = [
        item for item in (_field(brief, 'localEtiquette', []) + _field(brief, 'weatherAdvice', []) + _field(brief, 'safetyTips', []))
        if item and 'verified trip data is ready to explore' not in str(item).lower()
    ]
    if not brief_recommendations:
        brief_recommendations = _grounded_recommendations(request, trip, max_temp, pressure, route, alerts)
    story.extend([Spacer(1, 12), Paragraph('AI recommendations', H2), Paragraph('<br/>'.join(f'- {_text(x)}' for x in brief_recommendations[:8]), BODY), PageBreak()])

    story.extend([Paragraph('Day-wise timeline', H1), Paragraph('A simple rhythm for each day, anchored to your verified trip data.', SMALL), Spacer(1, 8)])
    for day in days:
        entries = day.get('stops', []) if isinstance(day, dict) else []
        rows = [[Paragraph(f'<b>DAY {day.get("day", "")}</b>', H2), Paragraph('Verified plan', SMALL)]]
        for entry in entries:
            if not isinstance(entry, dict): continue
            location = entry.get('location') if isinstance(entry.get('location'), dict) else entry
            name = location.get('name', 'Planned stop') if isinstance(location, dict) else str(location)
            time = entry.get('time', 'Explore')
            slot = entry.get('slot')
            activity = entry.get('activity')
            label = f"{time} · {slot}" if slot else time
            detail = f"<b>{_text(name)}</b>"
            if activity and entry.get('slot') not in ('start', 'end'):
                detail += f"<br/><font color=\"#64748B\">{_text(activity)}</font>"
            rows.append([Paragraph(f'<b>{_text(label)}</b>', BODY), Paragraph(detail, BODY)])
        story.append(Table(rows, colWidths=[32 * mm, 146 * mm], style=TableStyle([('BACKGROUND', (0, 0), (-1, 0), PALE), ('BOX', (0, 0), (-1, -1), .5, colors.HexColor('#E2E8F0')), ('LINEBELOW', (0, 1), (-1, -1), .25, colors.HexColor('#EDF2F7')), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9), ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)])))
        story.append(Spacer(1, 8))
    if not days: story.append(Paragraph('No day-wise stops were returned. Use the live map to build your route.', SMALL))
    story.extend([PageBreak(), Paragraph('Stay shortlist', H1)])
    if hotels:
        for hotel in hotels[:6]:
            image = _image(hotel.get('photoUrl'), 58 * mm, 32 * mm)
            card = [[image or Paragraph('Photo unavailable', SMALL), Paragraph(f'<b>{_text(hotel.get("name", "Stay"))}</b><br/>Rating: {_text(hotel.get("rating", "—"))}<br/><br/><font color="#64748B">Selected from verified Google Places results.</font>', BODY)]]
            story.append(Table(card, colWidths=[62 * mm, 116 * mm], style=TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.white), ('BOX', (0, 0), (-1, -1), .5, colors.HexColor('#E2E8F0')), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)])))
            story.append(Spacer(1, 8))
    else:
        # "No listings were available" reads as "this place has no hotels".
        # When the lookup itself failed -- an unenabled API, an exhausted quota
        # -- say that instead, so nobody plans around a false absence.
        issues = _unwrap(_field(trip, 'dataIssues', [])) or []
        stay_issue = next((str(item) for item in issues if 'stay' in str(item).lower()), None)
        story.append(Paragraph(
            _text(stay_issue) if stay_issue
            else 'No verified hotel listings were available for this destination.',
            SMALL,
        ))
    packing = [item for item in (_field(brief, 'packingChecklist', []) or []) if item]
    if not packing:
        packing = _packing_items(request, trip, max_temp, precip_prob)
    safety = [item for item in ((_field(brief, 'safetyTips', []) or []) + (_field(brief, 'localEtiquette', []) or []) + (_field(brief, 'emergencyContacts', []) or [])) if item and 'no additional verified safety notes' not in str(item).lower()]
    safety.extend(_safety_items(trip))
    # De-duplicate while preserving the order in which verified facts appear.
    safety = list(dict.fromkeys(safety))
    story.extend([Spacer(1, 8), Paragraph('Packing checklist', H1), Paragraph('<br/>'.join(f'[ ]  {_text(x)}' for x in packing), BODY), Spacer(1, 12), Paragraph('Safety and local notes', H2), Paragraph('<br/>'.join(f'- {_text(x)}' for x in safety) or 'No sourced safety note was returned for this trip.', BODY)])

    # The planner writes one practical paragraph per trip (TripSummary.travel_tips)
    # and the PDF was dropping it on the floor entirely.
    travel_tips = _field(trip, 'travel_tips', None) or _field(trip, 'travelTips', None)
    if travel_tips:
        story.extend([Spacer(1, 12), Paragraph('Practical tips for this trip', H2), Paragraph(_text(travel_tips), BODY)])

    story.extend([Spacer(1, 16), _qr(request.get('tripUrl') or f"{os.environ.get('CLIENT_URL', 'http://localhost:5173')}/map?destId={request.get('destId', '')}"), Paragraph('Scan to reopen this trip in Sahyatri.', SMALL)])
    doc.build(story)
    output.seek(0)
    return output
