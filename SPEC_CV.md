# LLM Prompting Tasks 
## Tech stack : NextJS 16, Tailwind 4.2, Supabase 2.95.6, NodeJS 20.9.0, TypeScript 6.0.3

## Working agreements
- Add a call to MCP server (Context7, Supabase, DuckDuckGo) for each artifact that needs a call from one of this MCP server. For example, if you don't know how to create a Router on NextJS, call `Context7`
- All UI needs to be in French, only language coding is in English and respect JS language style coding.
- Ask clarifying questions when scope is unclear.
- Prefer TypeScript over JavaScript for new files.
- Use ESLint and Prettier formatting conventions.
- Always run tests with Jest after modifying source files.
- Please ask me before continuing between each steps of this project.

## Environment variables
FRANCE_TRAVAIL_CLIENT_ID
FRANCE_TRAVAIL_CLIENT_KEY
ADZUNA_API_ID
ADZUNA_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_SECRET_KEY
OPENAI_KEY

## Naming conventions
- Functions and Variables: `camelCase` (`getUserProfile`, `generateTailoredResume`)
- Classes: `PascalCase` (`ResumeParser`, `GenerationService`)
- Constants: `UPPER_SNAKE_CASE` (`MAX_FILE_SIZE`, `SUPPORTED_FORMATS`)

## Your role and objectif
- With the help of the AI to create an application by automating the generation of a resume to apply by picking the most relevant elements of a resume following the job offer from France Travail and Adzuna API.
- You will also include a dashboard for job offer listings, a page for uploading a resume, a profile page section showing the detailed resume by category and a page to show all the current application state after generating a resume.
- System must focus only on data provided, preserve factual accuracy and never invent experience, skills, employers, dates, or credentials. It can only add some elements to add clarity and a better understanding to the recruiter and the user. 
- Only for the French and Monaco market, don't add data from another countries, for each extra decision you would like to take : put you in a role as of a Talent Acquisition and ask me

## Tasks

0. Add a simple authentification with username and password and a magic link
All the API under needs to be authentified

1. Upload the resume

In this task, you need to welcome the user by asking his resume or a corpus of their career, the user can also amend and delete it in the future.

The resume will be stored on Supabase as a Blob file.

This will be done in "Overview" page at the left of the second step and POST, GET, PUT '/api/upload' endpoints.

2. Resume in a corpus area

In this task, you need to show the resume in a PDF editer where the user can handle modifications with text formatting on his resume.
This will be done in "Overview" page at the right of the first step.
Once done, if some changes are done, upload the new resume and let also export it in `PDF` or `Doc` file into the Supabase bucket.
Add a button `Generate profile` to generate the `Profile` user section of the next task

3. Concatenate all the elements into `Profile` page section

In this task, after you have done the step 2, you need to create a dashboard where all the data to perform list job offer and generated resume are gathered with the help of AI generative. It's like a kind of the userspace where he has all his professional career. 

With the help of AI generative, create a JSON to retrieve all the following datas from the uploaded resume. Please respect the steps involved too.

Segment the page into two parts : 'Profile details' segmented with "Profil, Profession, Education, Profesional Experiences, Hobbies, Certifications, Skills" and store all in Supabase. These segments need to be translated in French. Let the user adds more experience, hobbies or other stuff if needed. The AI can transform `Skills, Certification, Hobbies, Profession` in a canonical form. The AI can rearrange and rewrite some elements from the resume.
If you could not add anything in a segment, leave it at a blank. Keep all of these segments in Supabase associated with an user key.
Add also the ROME code, to get it : process this : after consulting France Travail documentation, by using oAuth 2.0 system, with my client ID and secret specified on '.env' file, add a way to generate a refresh token on it for every time we need it. To retrieve the ROME code `codeRome`, consult `https://francetravail.io/produits-partages/catalogue/romeo/documentation#/api-reference/operations/Pr%C3%A9diction%20des%20appellations%20m%C3%A9tier%20du%20ROME`: if the scorePrediction is less than 0.7, please display "Unknown" or otherwise add the ROME code.

Segment the following parts into 'Profile requirements'

Before starting, look at segment filters from France Travail API documentation (`https://francetravail.io/produits-partages/catalogue/offres-emploi/documentation#/api-reference/operations/recupererListeOffre`), add segments like city, department or region (don't forget to add a dropdown from all cities, departments or regions in France by using `communes-france-2025.csv` and `departements-france.csv` from the workpath), radius, experience, disponibility, duration of contract, disabled accepted, wage and you can add other field if needed from France Travail API documentation. Please be conform with France Travail API documentation when adding UI components to filter.

Look also at segment filters from Adzuna API documentation (`https://developer.adzuna.com/activedocs#/default/search`), add segments like city, department or region (don't forget to add a dropdown from all cities, departments or regions in France by using `communes-france-2025.csv` and `departements-france.csv` from the workpath), radius, salary, contract or permanent, full or part-time, name of company. Please be conform with Adzuna API documentation when adding UI components to filter.

These segments from these two API needs to work in conjugation of each other. If one segment from the fields is missing in a given API : make it work for the one that handle it and for the other, perform the search without that parameter.

Add a button 'Search job offers' to display the job offer list from step 4 and 5.

This will serve as a template for the resume to be sended for the job offer.

4. List job offer France Travail inside a Jobs page

After consulting France Travail documentation, by using oAuth 2.0 system, with my client ID and secret (${`FRANCE_TRAVAIL_CLIENT_ID`} & ${`FRANCE_TRAVAIL_CLIENT_KEY`}) specified on '.env' file, add a way to generate a refresh token on it for every time we need it. With the refreshed token, try to get all the job list (with API documentation URL : `https://francetravail.io/produits-partages/catalogue/offres-emploi/documentation#/api-reference/operations/recupererListeOffre`) for the user query filtered by his ROME code and the components from 'Profile requirements'. If the ROME code is Unknown, use the "Profession" on "Profile details" (`motsCles`) to include the full job profession. Retrieve on each job at least title, description, experience, city, wage and contract type based on API data and above all don't forget to extract the link to apply, add it to the component with a button : `Generate resume` and display it on the sidebar 'Public offer'.

The job list needs to be on tab called 'Public offer' from page 'My offers' and fetched from my internal API `/api/offers/france-travail` with query parameters from 'Profile requirements' of the third step.

5. List job offer Adzuna API inside a Jobs page

In this task, list all job offer in France only with my ${`ADZUNA_API_ID`} and ${`ADZUNA_API_KEY`} on '.env' file , show it on a tab called 'Private offer' and fetched from my internal API on '/api/offers/adzuna' with query parameters from 'Profile requirements' of the third step. Before starting, try to understand the Adzuna API documentation, check the link (`https://developer.adzuna.com/activedocs#/default/search`) and filter it with `Profile requirements`. Retrieve on each job at least title, description, city, wage and contract type and above all the link to apply and a button `Generate resume` and display it on the sidebar from Private offer.

6. Classify job list from Adzuna and France Travail

On this task, you need to respect the following protocol on the file `deep-research-report.md` to perform a ranking on scoring each job offer from the offers list in comparison with the resume.

7. Generate the resume by matching element on the job offer and resume

With the help of AI, you need to be careful on the offer and retrieve each of the following section on the new resume : 
- Name
- Contacts
- Full name of job offer
- Key skills (see on job offer description, otherwise see in France Travail what is the key skills for this offer)
- Profesional Experience (with little summary of work and achievements)
- Education (all details from resume)
- Languages
- Certifications (qualification or certificate from online course platform, training course…)
- Realisations (personal project or blogs, work research, our creations...)
- Hobbies
 The resume needs to be readed in linear way and the form style respects French grammar and syntax, keep it simple, not overloaded. Please try to do it in one page. Do it on `/api/generate`

8. Job offer storage in Supabase

In this task, you need to store all the job offer specified on `/api/offers/adzuna` or `/api/offers/france-travail` for an user. As these data need to be keep only each 24 hours, call only the France Travail and Adzuna API to refresh the data : on the first visit, after 24 hours refreshing automatically the outdated data, when the user wants to refresh the registered data (on this case, append the new data to old data in the database) or when user made an another job search query different of the old cached job search queries datas.

9. My applications page
On this task, the generated resume needs to be located on an another page called "My applications" in a row option where the user can retrieve the generated resume in `PDF` or `Doc` file, the contents of the job offer and the URL . All these files need to be stored in a bucket Supabase, also the job's offer content with the URL offer needs to be stored. The user will have three options ("Accepted", "Pending", "Refused") to select on each option of in order to get the status of the job apply. He can delete it also but send a dialog confirmation before to delete it.

10. Mini statistics on the My Applications page
On this task, for all accepted applications, the top 3 counting of what is your skills on the resume based on matching job offer who seems to delight recruteirs and do the inverted one with all refused application