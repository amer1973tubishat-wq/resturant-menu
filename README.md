# resturant-menu
## Editing the site

Everything on the page is editable from the dashboard at `#admin`, in both
Arabic and English:

| Tab | What it covers |
|---|---|
| المنيو / Menu | Items: name, price, description, category, heat, badge, photo |
| الأقسام / Categories | The sections shown before the menu, with their images |
| الاسم / Brand | The restaurant name, in two parts, and the logo |
| الواجهة / Hero | The main photograph |
| النصوص / Text | Every string on the site — navigation, headlines, buttons, story, opening status, currency, footer — plus the ingredient chips |
| اصنع برجرك / Builder | The build-your-own steps, every option and every price |
| الألوان / Colours | The four colours the whole site is built from |
| الأوقات / Hours | Opening and closing times, per day |
| التواصل / Contact | WhatsApp, phone, Instagram, Facebook, TikTok, map link |

Saving is automatic: a change is written about a second after you stop typing,
immediately when you leave a field, and again if the page is closed. The Save
button is still there, and means "save now".

`tests/save-flow/editable.js` fails if a string is added to the page without
being exposed here.
