<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Frontdesk architecture
- Negotiation/availability/deposit math lives in `src/lib/engine.server.ts`; the AI only relays tool results — keeps prices within vendor limits.
- Stores are public; chat needs sign-in and each conversation is owned by the customer account and read with RLS. Vendor tools resolve the business by owner + slug — keeps each account's data private.
- One login can be customer and vendor at once; roles live only in `user_roles`, never in profiles — prevents escalation through editable fields.
- Hold expiry is derived on read (no cron) — avoids recurring backend cost.
- No online payment integration: businesses arrange payment directly and only authenticated owners may manually confirm deposits after checking their own records; a receipt or chat message never automatically confirms payment.
- Receptionist setup (`ReceptionistSetup`) saves the full vendor record only on the last stage — prevents half-configured desks. Business limits (free 1, pro 3) are enforced by a DB trigger.
- AI replies are metered per business in `ai_usage`, deducted daily from the owner's wallet by pg_cron; `/api/chat` pauses the receptionist when the wallet can't cover a reply — pay as you go with no card integration yet.
- Keep Bookie industry- and country-neutral: varied trades, no default single-industry or single-country data.
- Customer app lives at `/feed`, `/search`, `/store/<slug>`, `/messages`, `/chat/<id>`, `/me`; vendor app at `/business/<slug>/…`. Old `/<slug>` and `/b/<slug>` redirect to the store; `src/lib/reserved.ts` blocks slugs that collide.
- Each business stores country, currency (ISO) and IANA timezone; all prices/times use them, while Bookie's AI wallet is in US cents — global product.
