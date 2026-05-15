# Google Sheets Dashboard Template (Ready to Build)

This is a concrete, copy-ready dashboard design for the Daily Shift Handover System.

## 1) Workbook tabs

Create tabs in this order:

1. `Form_Responses` (auto-created by Google Form)
2. `Settings`
3. `Tasks_Open`
4. `Incidents_Open`
5. `Dashboard`

---

## 2) `Settings` tab

Use two columns:

- Column A = key
- Column B = value

Recommended keys:

- `Target Label` → `Units`
- `Late Handover Threshold (minutes)` → `20`
- `Default Date Range (days)` → `7`

Optional lookup lists (put in columns D onward and use for dropdown validation in the Form):

- Departments
- Shift Types
- Shortfall Reasons
- Scrap Causes
- Status values

---

## 3) Expected core columns in `Form_Responses`

Assuming your Google Form captures these fields (header row in row 1):

- `Timestamp`
- `Date`
- `Shift`
- `Department`
- `Outgoing supervisor name`
- `Incoming supervisor name`
- `Target production`
- `Actual production`
- `Reason for shortfall`
- `Total scrap`
- `Primary scrap cause`
- `Main line status`
- `Any breakdowns?`
- `Breakdown description`
- `Total downtime (minutes)`
- `Maintenance work order raised?`
- `Any quality issues?`
- `Issue description`
- `Affected lot numbers`
- `Action taken on quality issue`
- `Any incidents or near-misses?`
- `Incident description`
- `First aid or medical attention required?`
- `Raw material stock level`
- `Material needing replenishment`
- `Tasks pending for next shift`
- `Critical information for incoming supervisor`
- `Ongoing issues to monitor`
- `Number of workers on shift`
- `Absentees`
- `Overall shift rating`
- `Requires manager escalation?`
- `Escalation reason`

> If your exact header names differ, update formulas below to match.

---

## 4) Derived helper columns in `Form_Responses`

Add these helper columns to the right of form columns.

### A) `Variance`
In first data row (example row 2):

```gs
=IF(OR(H2="",I2=""),,I2-H2)
```

(Assumes `H=Target production`, `I=Actual production`.)

### B) `Shortfall Flag`

```gs
=IF(OR(H2="",I2=""),,IF(I2<H2,1,0))
```

### C) `Incident Flag`

```gs
=IF(U2="Yes",1,0)
```

### D) `Quality Flag`

```gs
=IF(Q2="Yes",1,0)
```

### E) `Breakdown Flag`

```gs
=IF(M2="Yes",1,0)
```

### F) `Handover Delay (mins)`
If you also collect shift end time in form; otherwise skip this metric.

```gs
=IFERROR((A2-<shift_end_datetime_cell>)*1440,)
```

Fill formulas down.

---

## 5) `Tasks_Open` tab

Purpose: power the “Action for Next Shift” board.

Columns:

- `Date`
- `Department`
- `Shift`
- `Task`
- `Priority`
- `Owner`
- `Due`
- `Status`
- `Source Timestamp`

Populate with array formula from form responses (example using `Tasks pending for next shift`):

```gs
=ARRAYFORMULA(QUERY({Form_Responses!B2:B,Form_Responses!D2:D,Form_Responses!C2:C,Form_Responses!Z2:Z,IF(Form_Responses!AF2:AF="Yes","High","Med"),Form_Responses!F2:F,"",IF(Form_Responses!Z2:Z<>"","Do This Shift",""),Form_Responses!A2:A},"select Col1,Col2,Col3,Col4,Col5,Col6,Col7,Col8,Col9 where Col4 is not null",0))
```

Board logic for `Status`:

- `Urgent Now` if escalation = Yes
- `Do This Shift` default
- `Waiting / Blocked` manual update
- `Done` manual update

---

## 6) `Incidents_Open` tab

Columns:

- `Timestamp`
- `Date`
- `Department`
- `Shift`
- `Incident description`
- `First aid required`
- `Status`
- `Aging (hours)`

Populate incidents:

```gs
=ARRAYFORMULA(QUERY({Form_Responses!A2:A,Form_Responses!B2:B,Form_Responses!D2:D,Form_Responses!C2:C,Form_Responses!V2:V,Form_Responses!W2:W,IF(Form_Responses!V2:V<>"","Open",""),IF(Form_Responses!V2:V<>"",(NOW()-Form_Responses!A2:A)*24,)},"select Col1,Col2,Col3,Col4,Col5,Col6,Col7,Col8 where Col5 is not null",0))
```

Use conditional formatting:

- Aging > 24h → amber
- Aging > 48h → red

---

## 7) `Dashboard` tab layout

## A) Filters row (top)

Cells:

- `B2`: Start date
- `C2`: End date
- `D2`: Department (dropdown incl. `All`)
- `E2`: Shift (dropdown incl. `All`)

## B) KPI tiles

### 1. Open High-Priority Items

```gs
=COUNTIFS(Tasks_Open!E:E,"High",Tasks_Open!H:H,"<>Done")
```

### 2. Unresolved Incidents

```gs
=COUNTIFS(Incidents_Open!G:G,"Open")
```

### 3. Shifts Logged This Week

```gs
=COUNTIFS(Form_Responses!B:B,">="&TODAY()-WEEKDAY(TODAY(),2)+1,Form_Responses!B:B,"<="&TODAY())
```

### 4. On-time Handovers %

If tracking delay mins in helper column `AK`:

```gs
=IFERROR(COUNTIFS(Form_Responses!AK:AK,"<="&Settings!B2)/COUNT(Form_Responses!AK:AK),0)
```

Format as percent.

## C) Charts

1. **7-day Actual vs Target trend** (line chart)
   - Use pivot table from `Form_Responses` by Date with sum Target and sum Actual.

2. **Missed target count by shift** (column chart)
   - Pivot by Shift with sum of Shortfall Flag.

3. **Top shortfall reasons** (bar chart)
   - Pivot by Reason for shortfall with count.

4. **Shift rating trend** (line)
   - Average Overall shift rating by Date.

## D) Action tables

- **Action for Next Shift**: filtered view of `Tasks_Open` where Status <> Done.
- **Incident & Risk Panel**: filtered view of `Incidents_Open` where Status = Open.

---

## 8) Conditional formatting rules

Apply in `Dashboard` and source tabs:

- If `Status = Urgent Now` → red fill, white bold text.
- If `Status = Waiting / Blocked` → amber fill.
- If `Raw material stock level = Critical (<20%)` → red fill.
- If `Actual production < Target production` → light red row highlight.
- If `Any incidents or near-misses? = Yes` → red indicator icon/text.

---

## 9) Fast setup checklist (under 30 minutes)

1. Build the Google Form with the field names above.
2. Link Form to a Sheet (creates `Form_Responses`).
3. Add `Settings`, `Tasks_Open`, `Incidents_Open`, `Dashboard` tabs.
4. Paste formulas and adjust header references if needed.
5. Create 4 KPI tiles + 3 core charts.
6. Add conditional formatting.
7. Protect formula columns/tabs.
8. Share with supervisors (edit) and managers (view).
