This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Project outline

- User enters the flow and has to go through numerous screens. Name, email, flight info, etc.
- React-hook-form will be used for forms and it will handle form validation as well.
- We update the local state with `zustand` in between each step so user can safely go back and forward while finishing flow.
- When the user arrives on the final step we connect to a payment provider.
- If the payment is successful, we update the google doc and empty the local storage. Otherwise we return user to an error page with info on what went wrong.
- Should we include some sort of error logging so we can see if something goes wrong?

## Steps in order process

### Steps in booking flow

**_Current Bagger_**

- Choose Day of flight
  - DateTime (datepicker).
- Choose Airline
  - List of airlines (icons + find others).
- Select destination
  - List of destinations (dropdown).
- Email address
  - User enters email address to continue.
- Select bag quantity
  - User picks number of bags (1-4) option to select more (5-8) with price.
- Pick morning or evening flight
  - Morning. Bags will be picked up between 18:00-22:00 the day before.
  - Evening. Bags will be picked up between 11:00-13:00 same day.
- Contact information
  - Full name - string
  - Phone number - Country code + number
  - Address - string
  - City/Town(autocomplete) - string
  - Postal code(autocomplete) - string
  - Other information - string
  - Company invoice information - string
- User goes to checkout (Rapyd in case of current Vix implementation)
- User pays the price in question and is redirected back to Bagger with:
  - Success, a confirmation page is displayed (email confirmation to customer as well?).
  - Error, a pages that lists to user why the order didn’t succeed.
  - Cancel, the user has cancelled the payment and is offered to start over.

**_Airportr_**

- Choose airline
- Choose departure airport
- Choose date
- Choose arrival airport
- Choose amount of bags + optional email
- Choose exact flight from list of flights - ?? (mock?)
- Choose place to collect bags from (residential or hotel)
  - Enter address or post code (autocomplete)
  - Enter address manually
    - When chosen a confirmation screen appears
- Choose pick up slots for bags - ??
  - 3hr pick up slots?
  - 1hr pick up slots (more expensive)?
- Review and confirm order
  - Email
  - First name
  - Last name
  - Phone number
  - Payment info
  - Billing address
