# -*- coding: utf-8 -*-
"""Sections: Executive Summary, Acknowledgements, Chapter 1, Chapter 2."""

STUDENT = "[Student Full Name]"
STUDENT_ID = "[Student ID Number]"
FACULTY = "Faculty of Computing and Informatics"
DEPT = "Department of Information Technology"
COMPANY = "AFRICOM Technologies PLC"
COMPANY_FULL = "AFRICOM Technologies PLC, Addis Ababa, Ethiopia"

EXEC_SUMMARY = [
    ("p", "This report presents the details and outcomes of my internship programme undertaken at "
          "AFRICOM Technologies PLC in Addis Ababa, Ethiopia, as a partial fulfilment of the degree of "
          "Bachelor of Science in Information Technology offered at Debre Berhan University. The internship "
          "was carried out during the 2018 E.C. academic year for a period of approximately three months. "
          "During this period, I was attached to the Software Development Section of the company and worked "
          "as a junior full-stack developer on the development of FieldSync, an offline-first registration and "
          "reporting system designed for government field officers working in rural areas of Ethiopia."),
    ("p", "FieldSync was built to solve a real and serious problem. Field officers who register citizens and "
          "submit daily field reports often work in places where there is no internet connection. In such "
          "environments, paper-based records are easily lost, damaged or delayed, and supervisors receive "
          "field data days or weeks after it is collected. FieldSync addresses this by following an "
          "offline-first design: data entered on a phone or laptop is saved instantly in a local browser "
          "database (IndexedDB using the Dexie library) and is later synchronised automatically to a central "
          "server whenever the device reconnects to the internet."),
    ("p", "During the internship, my tasks covered the full development lifecycle: requirements gathering and "
          "user-role analysis, system design and architecture, database design in PostgreSQL, building the "
          "REST application programming interface with Node.js and Express, developing the React and "
          "Tailwind CSS front end, implementing the offline synchronisation engine, integrating the Global "
          "Positioning System for citizen registration, adding support for four Ethiopian languages, and "
          "preparing the system for deployment using Docker Compose."),
    ("p", "The internship significantly improved my practical programming skills, upgraded my theoretical "
          "understanding of software engineering concepts such as offline data synchronisation, conflict "
          "resolution and progressive web applications, and helped me develop my communication, teamwork, "
          "leadership, work-ethic and entrepreneurial skills. The report is organised into four chapters. "
          "Chapter One describes the hosting company; Chapter Two discusses the overall internship "
          "experience, the tasks I executed and the problems I identified; Chapter Three explains the "
          "benefits I gained; and Chapter Four presents conclusions and recommendations. References and "
          "appendices supporting the report are included at the end."),
]

ACKNOWLEDGEMENTS = [
    ("p", "First and foremost, I would like to thank the Almighty God for His grace and guidance throughout my "
          "studies and during this internship programme."),
    ("p", "I would like to express my sincere gratitude to Debre Berhan University, particularly the "
          "Department of Information Technology, for arranging the internship programme and for giving me "
          "the opportunity to put the knowledge I gained in class into practice in a real working "
          "environment. I am also grateful to my internship advisor for the continuous guidance, comments "
          "and constructive feedback offered while I was writing this report."),
    ("p", "I am deeply thankful to the management and staff of AFRICOM Technologies PLC for welcoming me into "
          "the company, for providing the necessary facilities and resources, and for giving me the chance "
          "to work on a real production system. Special thanks go to my internship mentor in the Software "
          "Development Section who followed my progress closely, reviewed my work, and taught me good "
          "practices in software development. I am also grateful to the FieldSync project team members who "
          "supported me with patience and made the working atmosphere enjoyable."),
    ("p", "Finally, I would like to thank my family and friends for their moral support, encouragement and "
          "prayers during my stay in Addis Ababa."),
]

# =====================================================================
# CHAPTER ONE
# =====================================================================

CHAPTER_1 = [
    ("h1", "CHAPTER ONE - BACKGROUND OF THE INTERNSHIP HOSTING COMPANY"),
    ("h2", "1.1 Introduction"),
    ("p", "This chapter presents the background of the company that hosted my internship, AFRICOM "
          "Technologies PLC. It describes the brief history of the company, its vision and mission, the main "
          "products and services it provides, its main customers and end users, and its overall "
          "organisational structure and workflow. The chapter also introduces the specific project, "
          "FieldSync, on which I worked, because an understanding of the company is essential to "
          "understand the environment in which the project was developed."),
    ("h2", "1.2 Brief History of the Company"),
    ("p", "AFRICOM Technologies PLC is an Ethiopian information technology solutions and service provider "
          "company headquartered in Addis Ababa, in the Bole sub-city. The company was founded in 2004 by "
          "young Ethiopian entrepreneurs with the aim of bringing effective, affordable and internationally "
          "competitive IT solutions to the Ethiopian market. Over the last two decades the company has grown "
          "from a small startup into one of the most recognised IT solution providers in the country, and it "
          "is one of the first companies of its kind in Ethiopia to become certified to the ISO 9001:2015 "
          "quality management standard."),
    ("p", "According to the company, its growth is driven by a culture of putting the customer's concerns "
          "first and by strategic partnerships with international technology providers. Through these "
          "partnerships AFRICOM has been able to concentrate on delivering effective solutions across "
          "software development, business process outsourcing, government technology projects and network "
          "infrastructure. The company maintains its operations in Addis Ababa and serves clients across "
          "Ethiopia and, through its outsourcing services, in other countries in Africa, Asia and Europe. "
          "With more than twenty years of continuous operation, AFRICOM has built a reputation as an "
          "implementation-focused company that designs solutions and also customises, deploys and maintains "
          "them."),
    ("h2", "1.3 Vision and Mission"),
    ("p", "The vision of AFRICOM Technologies PLC is to architect the digital future of Africa through "
          "relentless innovation and implementation excellence. The company sees itself as a cornerstone of "
          "the African technology ecosystem, and it wants every Ethiopian and African organisation to be able "
          "to benefit from modern digital services."),
    ("p", "The mission of the company is to provide innovative, cost-effective and top-quality IT solutions "
          "for businesses, government institutions and civil society organisations. It aims to achieve this "
          "through custom software development, responsible technology consulting, international-standard "
          "implementation practices, and continuous capacity building. The company also places a strong "
          "emphasis on ISO-certified processes so that its solutions are delivered in a transparent and "
          "reliable manner."),
    ("h2", "1.4 Main Products and Services"),
    ("p", "AFRICOM Technologies PLC offers a wide range of information technology products and services. The "
          "main product and service lines observed during my stay are summarised below."),
    ("bullets", [
        "Custom software development: design and development of tailor-made applications for the web, "
        "desktop and mobile platforms, using modern technologies such as React, Node.js and PostgreSQL.",
        "Government technology (GovTech) solutions: building national-scale digital frameworks, including "
        "single-window systems, management information systems and logistics systems for government clients.",
        "Management information system consultancy: advising organisations on how to structure and automate "
        "their information flows, collecting, storing and reporting on the data that managers need.",
        "Business process outsourcing (BPO) and IT outsourcing: providing offshore, nearshore and onshore "
        "outsourcing services, back-office support and technical support for clients in Asia, Europe and "
        "Africa.",
        "Enterprise resource planning and e-commerce: integration of finance, human resources and supply "
        "chain functions into single systems, and development of online stores with payment and shipping "
        "integration.",
        "Networking, infrastructure and security: planning and installing local area networks, wireless "
        "networks and security solutions for offices and institutions.",
        "IT auditing: evaluating IT infrastructure and policies to determine whether computer systems "
        "safeguard assets, maintain data integrity and use resources efficiently.",
        "Training and capacity building: short courses and the operation of a technology hub for students "
        "and professionals.",
        "Resource augmentation: providing skilled developers, designers and quality-assurance professionals "
        "to scale client teams quickly.",
    ]),
    ("p", "From this list it is clear that AFRICOM does not only sell products; it provides complete solutions "
          "with custom implementation, customisation, training and long-term maintenance services."),
    ("h2", "1.5 Main Customers and End Users"),
    ("p", "The main customers of AFRICOM Technologies PLC are government ministries and agencies, public "
          "institutions, private enterprises, small and medium businesses, non-governmental organisations and "
          "international clients that outsource software work. Because of the company's history in "
          "e-government projects, a large part of its client base is in the public sector."),
    ("p", "For the FieldSync system specifically, the direct users are the employees of a regional "
          "administration that runs a citizen data collection programme. The intended end users of the system "
          "are three groups. Field officers are the members of staff who go out into rural villages to "
          "register citizens and who manually collect data such as names, dates of birth, addresses and GPS "
          "locations, and who complete a daily field report. Supervisors are the staff members who oversee a "
          "smaller group of field officers, verify their reports, approve leave and permission requests, and "
          "evaluate officer performance. Managers are the senior staff who view analytics, dashboards and "
          "aggregate reports for a whole region, manage the user accounts, and communicate with all staff "
          "through alerts and notifications."),
    ("h2", "1.6 Overall Organisational Structure and Workflow"),
    ("p", "AFRICOM Technologies PLC is organised functionally. The general manager, who is also the founder, "
          "leads the whole company. Under the general manager, the company is divided into a number of "
          "distinct sections and teams, including the Software Development Section, the GovTech and "
          "E-Government Section, the BPO and Outsourcing Section, the IT Consulting and Audit Section, the "
          "Networking and Security Section, and service lines dealing with e-commerce and enterprise resource "
          "planning systems, e-learning, training and the technology hub. Support functions such as finance, "
          "human resources and marketing operate across all sections. The organisational structure is "
          "illustrated in Figure 1.1 below."),
    ("fig", {"file": "org_chart.png", "caption": "Simplified organisational structure of AFRICOM Technologies PLC",
             "width_in": 6.0, "label": "Figure"}),
    ("p", "The workflow within the company follows a project-based pattern. When a client request is received, "
          "the commercial team prepares a proposal and, once the contract is signed, a project team is "
          "formed. For software projects the work passes through a typical lifecycle consisting of "
          "requirements gathering and analysis, system design, development, testing, deployment and "
          "maintenance. For medium-size projects the team works in two-week iterations, with daily stand-up "
          "meetings and a task board, so that progress is visible to everyone and the client can give "
          "feedback continuously. This agile-style workflow was the direct working method used in the "
          "Software Development Section during my internship."),
    ("h2", "1.7 The Internship Placement and Project Context"),
    ("p", "I was placed in the Software Development Section of the company and assigned to the FieldSync "
          "project team. FieldSync is an offline-first registration and reporting system that I will describe "
          "in detail in Chapter Two. The project had been initiated because the client, a regional "
          "administration, needed a reliable way for field officers in remote villages to register citizens "
          "and submit daily reports even though the connectivity in those areas is very poor. My role in the "
          "team was that of a junior developer, working under the guidance of senior developers and my "
          "mentor."),
    ("p", "Working on FieldSync gave me the chance to apply practically almost everything I had learned in "
          "class: web development, databases, software engineering, human-computer interaction and systems "
          "analysis. It also gave me the opportunity to work inside a real software team, to observe how a "
          "professional Ethiopian IT company organises its work, and to contribute to a system that will "
          "improve the way government data is collected in rural areas."),
    ("h2", "1.8 Chapter Summary"),
    ("p", "This chapter has described the hosting company. AFRICOM Technologies PLC is an ISO-certified "
          "Ethiopian IT solutions company founded in 2004 with more than twenty years of experience in "
          "software development, government technology, business process outsourcing and IT consulting. The "
          "company follows a functional organisational structure and a project-based workflow, and it serves "
          "government and private clients. My internship was hosted in the Software Development Section where "
          "I contributed to the FieldSync project. The next chapter presents in detail the whole internship "
          "experience."),
]

# =====================================================================
# CHAPTER TWO
# =====================================================================

CHAPTER_2 = [
    ("h1", "CHAPTER TWO - OVERALL INTERNSHIP EXPERIENCE"),
    ("h2", "2.1 How I Joined the Company"),
    ("p", "The Debre Berhan University Department of Information Technology announces internship "
          "placements for final-year students during the second half of the academic year. Interested "
          "students submit their applications together with their academic records, and the department "
          "shortlists candidates on the basis of their performance in relevant courses such as web "
          "programming, databases, data structures and software engineering. I applied through this process "
          "and was shortlisted and referred to AFRICOM Technologies PLC."),
    ("p", "I then went through an interview and a short technical discussion at the company, where I was asked "
          "about my knowledge of web technologies, my experience with JavaScript and my interest in "
          "developing systems for real users. After the interview I received an offer letter indicating the "
          "starting date and the duration of the internship, and I reported to the company on the first "
          "working day."),
    ("h2", "2.2 Orientation and Onboarding"),
    ("p", "The first week of the internship was dedicated to orientation. I was given a tour of the office, "
          "introduced to the employees of the different sections, and given the company's employee handbook, "
          "which explains rules regarding working hours, dress code, data confidentiality and internal "
          "communications. I also received a desk and a work laptop, and the ICT section created accounts for "
          "me on the tools used inside the company."),
    ("p", "During onboarding I visited the FieldSync project repository, read the project documentation and "
          "the codebase, and was given a walkthrough of the architecture by a senior developer. I installed "
          "the development environment on my machine, which included Node.js, Git, PostgreSQL and Docker, "
          "and I successfully ran the application locally by the end of the first week. This early milestone "
          "gave me confidence and helped me understand the rest of the work."),
    ("h2", "2.3 The Department Where I Worked"),
    ("p", "I worked in the Software Development Section of AFRICOM Technologies PLC. This is the section "
          "responsible for designing, building, testing and maintaining the software products of the company. "
          "The section is organised into small teams, each focused on one project. I was assigned to the "
          "FieldSync team, which at the time consisted of a project lead, two senior developers, a designer "
          "and two interns, including myself."),
    ("p", "The team was responsible for the whole FieldSync system: the web-based progressive web application "
          "used by managers and supervisors, the registration and reporting flows used by field officers, "
          "the offline storage layer that keeps data on the device, and the backend application programming "
          "interface and database that store the final, authoritative version of the data."),
    ("h2", "2.4 Workflow of the Department"),
    ("p", "The department followed an agile workflow. Each morning the team held a short stand-up meeting of "
          "about fifteen minutes in which every member reported what they had done the previous day, what "
          "they planned to do that day, and any blockers. Work was tracked on a task board where each task "
          "had a status such as 'to do', 'in progress', 'in review' and 'done'."),
    ("p", "The development cycle for a typical feature was as follows. First, the requirement was discussed "
          "with the project lead and the product owner. Second, the task was broken down and added to the "
          "board. Third, a developer created a new branch of the code, implemented the feature, and committed "
          "the changes with a clear commit message. Fourth, the branch was merged through a pull request, "
          "which was reviewed by another developer. Finally, the merged code was tested by the whole team and "
          "deployed to a staging server. Every two weeks the team demonstrated the completed work to senior "
          "management. This workflow taught me discipline, code review culture and the importance of clear "
          "communication."),
    ("h2", "2.5 Overview of the FieldSync System"),
    ("p", "FieldSync is an offline-first registration and reporting system. It is built to support government "
          "field officers who move from village to village registering citizens and collecting daily "
          "operational reports. Because these officers work in areas with very poor or no internet "
          "connectivity, the system is designed so that all data entry works even when the device is "
          "completely offline, and data is synchronised when the device regains connection."),
    ("p", "The system has three main user roles, each with different screens and permissions:"),
    ("bullets", [
        "Management (manager role): manages users, assigns shifts and regions, views dashboards, charts and "
        "performance statistics, sends alerts to all staff, approves supervisor reports and monitors whether "
        "officers are online.",
        "Supervision (supervisor role): follows a group of field officers, verifies daily reports and citizen "
        "registrations, approves leave and work-permission requests, assigns tasks, evaluates officers on "
        "several criteria and compiles supervisor reports.",
        "Field work (field officer role): checks in at the start of the shift, registers citizens with GPS "
        "coordinates and photo capture, completes a daily field report, requests leave or permission, and "
        "answers verification questions.",
    ]),
    ("p", "Technically, FieldSync is a progressive web application built with React and Vite, styled with "
          "Tailwind CSS, and made installable and offline-capable through the service worker generated by "
          "Vite's PWA plugin. Offline data is stored locally in the browser's IndexedDB using the Dexie "
          "library. The backend is a Node.js application built with Express, and the database is PostgreSQL. "
          "The system communicates through a JSON REST API, and photo attachments are handled with the "
          "Multer library. E-mail notifications such as new account credentials are sent using Nodemailer. "
          "The whole system is containerised with Docker."),
    ("p", "One important quality of the system is that local data and server data are never disconnected for "
          "long. When an officer enters data while offline, the record is stored locally with a status of "
          "'pending'. A background sync service watches the network and, as soon as the device is back "
          "online, pushes all pending records to the server. The server is designed to accept the same "
          "record several times without creating duplicates, using idempotent insert-or-update queries. "
          "Figure 2.1 shows the overall three-tier architecture of the system."),
    ("fig", {"file": "architecture.png", "caption": "Three-tier architecture of the FieldSync system",
             "width_in": 6.3, "label": "Figure"}),
    ("p", "Figure 2.2 summarises the offline-first synchronisation workflow that was at the heart of the "
          "project and that I worked on most closely."),
    ("fig", {"file": "sync_workflow.png", "caption": "Offline-first synchronisation workflow",
             "width_in": 6.1, "label": "Figure"}),
    ("h2", "2.6 Tasks Executed During the Internship"),
    ("p", "During the internship I executed a wide range of tasks. I describe below the main categories of "
          "work I performed, in the order in which they build on one another."),
    ("h3", "2.6.1 Requirements Gathering and Analysis"),
    ("p", "At the beginning of the project I was involved in reading the client requirements document and in "
          "listening to discussions with the product owner. I learned to distinguish functional requirements "
          "(what the system must do) from non-functional requirements (how well it must perform, how secure "
          "and reliable it must be). Together with a senior developer, I helped write user stories for the "
          "main roles and to list the forms, fields and rules needed for citizen registration, daily "
          "reporting, attendance and leave requests."),
    ("h3", "2.6.2 System Design and Architecture"),
    ("p", "I participated in the design discussions that produced the system architecture shown in Figure 2.1. "
          "The key design decisions were to make the application offline-first rather than online-only, to "
          "store local data in IndexedDB, to expose a single synchronisation endpoint for all record types, "
          "and to use PostgreSQL as the central database. I learned to draw architecture diagrams, to think "
          "about the boundaries between layers, and to justify design choices to the team."),
    ("h3", "2.6.3 User Interface Development with React and Tailwind CSS"),
    ("p", "A significant part of my work was building the user interface. I created and modified React "
          "components for the login page, the sidebar and header, the dashboard cards and charts, the "
          "citizen registration form, the daily report form, and management pages such as user management, "
          "team management, attendance, leave, permission, task and alert management. I used Tailwind CSS for "
          "styling, react-hook-forms and Zod for form input validation, and React Router for navigation. I "
          "also used the Recharts library to build the analytics charts on the manager dashboard and "
          "handled dark and light themes."),
    ("h3", "2.6.4 Offline Data Layer with IndexedDB and Dexie"),
    ("p", "One of the most interesting tasks was building the offline data layer. I wrote the Dexie database "
          "schema defining the local tables for users, citizens, reports, attendance, leaves, permissions, "
          "tasks, alerts, screen time, audit records and verification history. Each local table mirrors the "
          "server tables and carries an additional 'synced' status field. I also implemented helpers to "
          "store and read data locally so that the application continues to work when the server cannot be "
          "reached."),
    ("h3", "2.6.5 The Synchronisation Engine"),
    ("p", "The synchronisation engine is the brain of the offline-first design. Working from the design "
          "already started by the team, I implemented and refined the service that watches the network "
          "status, collects all pending records, sends them to the server in the correct order, marks them "
          "as synchronised and handles failures. The service uses an exponential backoff so that a failing "
          "record is retried after 3 seconds, then 6, then 12, and up to a maximum of five attempts. I also "
          "implemented the duplicate-citizen business rule on the server, which prevents a person from being "
          "registered twice when the first name, last name and grandfather's name all match."),
    ("h3", "2.6.6 Backend API Development with Node.js and Express"),
    ("p", "I wrote and fixed backend code in the Express API: authentication endpoints for login and password "
          "change, and route modules for users, citizens, reports, attendance, leaves, permissions, tasks, "
          "screen time, alerts, audit logs, verification and supervisor reports. I learned to structure a "
          "server into routes, controllers and models, to use parameterised SQL queries to prevent SQL "
          "injection, and to return consistent JSON responses to the front end."),
    ("h3", "2.6.7 Database Design and SQL"),
    ("p", "The central database is PostgreSQL. I designed and updated tables for the user accounts, citizen "
          "records, daily field reports, attendance, leaves, permissions, tasks, alerts, screen-time "
          "records, verification history, audit logs and supervisor reports. I wrote the SQL queries used by "
          "the synchronisation endpoint, including the idempotent insert-or-update statements that use the "
          "ON CONFLICT clause, and I helped write the startup scripts that create missing columns and seed "
          "the Ethiopian location hierarchy (region, zone, woreda, kebele and community)."),
    ("h3", "2.6.8 Authentication and Role-Based Access"),
    ("p", "I worked on the authentication module. Passwords are hashed with bcrypt before being stored, so "
          "plain-text passwords never appear in the database. New users created by a manager can be sent "
          "their account credentials by e-mail automatically. The application checks the role of the logged "
          "in user and shows only the screens relevant to that role, and inactive accounts are blocked at "
          "login. I learned the importance of protecting passwords and of always verifying the role of a "
          "user before allowing an action."),
    ("h3", "2.6.9 Location and GPS Integration"),
    ("p", "Because citizen registration must know where each citizen lives, the system captures the geograph-"
          "ical position of the officer at the moment of registration. I implemented the GPS capture "
          "component using the browser Geolocation API, recording latitude, longitude and the accuracy of "
          "the measurement, and displaying the coordinates to the user. The location is saved together with "
          "the citizen record and the daily report, and it is also stored in a GPS-location table on the "
          "server so that the movement of officers can be reviewed later. I also helped build cascading "
          "location selectors that walk the officer down from country to region, zone, woreda, kebele and "
          "community."),
    ("h3", "2.6.10 Support for Four Ethiopian Languages"),
    ("p", "FieldSync is used by staff whose working languages are different. I helped implement the "
          "internationalisation (i18n) layer using the i18next library, which allows the interface to switch "
          "between English, Amharic, Afaan Oromoo and Tigrinya. I added the translation files and a language "
          "selector in the user interface, and I made sure that newly added labels had translations in all "
          "four languages. This task taught me how to design software that is truly local, rather than "
          "assuming every user reads English."),
    ("h3", "2.6.11 Reporting, Dashboards and Analytics"),
    ("p", "I developed the reporting screens: the daily report form used by field officers, the report list "
          "and the reports seen by supervisors, and the aggregate reports page for managers. On the "
          "dashboard I helped build the statistics grid, the registration and trend charts, the top-performer "
          "list and the performance chart. These screens translate raw database records into decisions that "
          "managers make every day, and building them improved my understanding of data visualisation and "
          "the value of clean, aggregated data."),
    ("h3", "2.6.12 Additional Operational Modules"),
    ("p", "Beyond registration and reporting, FieldSync includes a family of smaller modules that together "
          "make the system complete. I contributed to most of them:"),
    ("bullets", [
        "Attendance: officers check in and out, and the system records status, work hours and screens.",
        "Leave and work-permission management: officers request leave or permission; supervisors approve or "
        "reject, and the decisions synchronise online and offline.",
        "Task management: supervisors assign tasks to officers with deadlines and priorities; officers update "
        "the status of their tasks.",
        "Alerts and notifications: the manager can broadcast an alert to everyone or to specific users, and "
        "users can mark alerts as read.",
        "Screen-time monitoring: the system tracks how long a user is logged in and calculates a trust score "
        "that is shown to supervisors.",
        "Verification: officers are occasionally asked a verification question; their answers and response "
        "times are recorded and scored.",
        "Audit log: important actions are recorded in an audit log with the user, action, details and "
        "timestamp, so that the history of the data can be traced.",
        "Online status: the server records whether each user is currently online or offline so that "
        "supervisors can see who is active.",
    ]),
    ("h3", "2.6.13 Testing, Debugging and Bug Fixing"),
    ("p", "I spent part of the internship testing the system and fixing bugs. I tested the synchronisation "
          "path by entering records offline, restarting the application, reconnecting and checking that all "
          "records reached the server exactly once. I also helped fix a number of real bugs, including a "
          "problem in which a profile photo disappeared after synchronisation because the front end and the "
          "database used different field names, and a bug in which the online/offline status of a user was "
          "shown incorrectly. Finding and fixing these bugs taught me how to use the browser developer "
          "tools, the network panel and the database console to trace a problem from the screen back to the "
          "data."),
    ("h3", "2.6.14 Deployment Preparation"),
    ("p", "Towards the end of the internship I helped prepare the system for deployment. I worked with the "
          "Docker Compose file that runs three containers: a PostgreSQL database, the Express backend and an "
          "nginx web server serving the built front end. I also verified the environment-variable "
          "configuration, tested the health endpoint that reports whether the database is reachable, and "
          "wrote notes for the person who would deploy the system. This experience introduced me to "
          "containerisation, a skill that is rarely taught in class but is essential in the industry."),
    ("h2", "2.7 Procedures Used While Performing the Tasks"),
    ("h3", "2.7.1 Development Environment"),
    ("p", "All of the code was developed on a Linux development machine using Visual Studio Code, with Git as "
          "the version control system and GitHub as the remote repository. The front end was run with the "
          "Vite development server, the backend with a TypeScript execution tool, and PostgreSQL either "
          "through Docker or directly on the machine. One useful technique I learned was to read the actual "
          "value of the API address from the hostname of the page, so that the application works correctly "
          "when it is opened from a phone on the same local network rather than only on localhost."),
    ("h3", "2.7.2 Version Control Workflow"),
    ("p", "Every change was tracked in Git. I followed the standard workflow: create a feature branch, make "
          "small logical commits with descriptive messages, push the branch, open a pull request, and wait "
          "for a review before merging. This procedure protected the main branch from broken code and gave "
          "me constant practice in writing commit messages, resolving merge conflicts and reviewing the "
          "work of others."),
    ("h3", "2.7.3 Coding Standards and Quality Checks"),
    ("p", "The project used a linter (ESLint) and consistent formatting rules. Before finishing a task I ran "
          "the linter and fixed all warnings, and I followed the existing naming conventions and file "
          "structure of the project. Because I was working with a large existing codebase, I learned to "
          "match the style of the surrounding code rather than imposing my own preferences."),
    ("h3", "2.7.4 Testing and Verification Procedure"),
    ("p", "Before a change was considered complete, I tested it according to a simple but strict procedure. "
          "First I tested the happy path (the feature working correctly), then I tested the edge cases (empty "
          "input, wrong input, duplicate records), and finally I tested the offline behaviour by turning off "
          "the network. Any bug found was logged on the task board or reported to the team lead, and "
          "regression tests were run on the previously working features before a release."),
    ("h2", "2.8 My Performance in Carrying Out the Assigned Tasks"),
    ("p", "On the whole, I performed the tasks assigned to me well. My mentor and the senior developers "
          "regularly reviewed my pull requests, and the feedback was generally positive. I was praised "
          "especially for the care I took with the synchronisation logic and for the readability of my "
          "components. The daily stand-up meetings also helped me to keep the team informed and to ask for "
          "help as soon as I was stuck, instead of wasting days on a problem I could not solve."),
    ("p", "At the same time, I observed areas where I needed to improve. In the beginning I wrote code before "
          "fully understanding the existing architecture, which caused me to redo some work. I also found it "
          "difficult at first to read large SQL queries and to follow asynchronous JavaScript control flow. "
          "With practice I improved in both areas. By the end of the internship I was able to take a small "
          "feature from a user story all the way to a merged and tested pull request without constant "
          "supervision, which I consider the clearest sign of my growth."),
    ("h2", "2.9 Problems Identified During the Internship"),
    ("p", "Working on a real system for real users exposed me to problems that are not visible in classroom "
          "projects. I identified the following problems during the internship:"),
    ("bullets", [
        "Network instability and sync conflicts: the connection in the field is unreliable, and a record "
        "that is edited both on the device and on the server at the same time creates conflicting versions. "
        "A clear conflict-resolution policy was needed.",
        "Duplicate citizen registrations: because registration is done quickly, officers can register the "
        "same person twice. The system handled the exact-match duplicate, but near-duplicates where the "
        "names are spelled slightly differently still remained possible.",
        "Large photo attachments: photos taken with a phone are large, and uploading many large photos over "
        "a weak connection is slow and sometimes fails.",
        "No automated test suite: most testing was done manually by the team, which is time-consuming and "
        "allows small regressions to slip through.",
        "Inconsistency between field names: the front end used camelCase field names while the database "
        "used snake_case names, and data (for example a profile photo) was lost when the two sides did not "
        "agree.",
        "First-login experience: new users received their passwords by e-mail, but officers without e-mail "
        "access could not use the flow, and the forced password change was confusing for some users.",
        "Amharic text handling: typing and rendering Amharic characters is usually fine, but mixing the "
        "languages in one field or copying text between applications sometimes produced inconsistent "
        "characters.",
        "Documentation gaps: the API had no complete, up-to-date documentation, so new team members had to "
        "read the code to understand the endpoints.",
        "Security and data privacy: citizen data is sensitive, and more attention was needed to data "
        "privacy, device security and the protection of the server.",
        "Timestamp and time-zone handling: records created offline at different times needed a consistent "
        "clock policy so that report dates remain meaningful.",
    ]),
    ("h2", "2.10 Proposed Solutions to the Identified Problems"),
    ("p", "For each problem I identified, I proposed a solution. Some proposals were implemented during the "
          "internship, while others were recommended for future releases:"),
    ("bullets", [
        "For sync conflicts, adopt a clear rule such as 'last write wins on individual fields' combined with "
        "a separate audit of what changed, and record every synchronisation in the audit log so that "
        "mistakes can be reversed.",
        "For duplicate citizens, strengthen the matching rule to also compare phone numbers and dates of "
        "birth, and show the officer possible matches before saving a new record.",
        "For large photos, compress and resize photos on the device before upload, and upload them "
        "separately from the text data with a progress indicator.",
        "For testing, introduce an automated test framework with unit tests for the validation and "
        "synchronisation logic and integration tests for the API, and connect it to continuous integration "
        "so that every commit is tested.",
        "For field names, keep the database and the API in agreement by documenting the mapping and by "
        "adding a conversion layer in one single place.",
        "For the first-login experience, allow managers to print or show initial credentials at the point "
        "of account creation in addition to e-mail, and support first-login from the same page.",
        "For Amharic text, use Unicode normalization consistently, test all inputs against the four target "
        "languages and avoid manual font assumptions.",
        "For documentation, generate OpenAPI documentation from the routes and keep it next to the code so "
        "it does not go out of date.",
        "For security, enforce strong passwords, protect the server with a firewall and HTTPS, encrypt "
        "backup copies of the citizen data and restrict export rights to senior managers only.",
        "For timestamps, store all times in UTC on the server and shift them to the Ethiopian time zone "
        "only at display time, so that offline records always have consistent dates.",
    ]),
    ("h2", "2.11 Chapter Summary"),
    ("p", "This chapter has described my internship experience at AFRICOM Technologies PLC. I joined the "
          "company through the university placement process, received a structured orientation, and worked "
          "in the Software Development Section on the FieldSync offline-first registration and reporting "
          "system. I performed tasks covering requirements analysis, system design, front-end development, "
          "database design, offline synchronisation, GPS integration, multi-language support and deployment "
          "preparation. I followed the department's agile and version-controlled workflow, and on the whole "
          "I performed well while learning several areas for improvement. I also identified a number of "
          "real-world problems and proposed practical solutions for them. The next chapter explains the "
          "benefits I gained from the whole experience."),
]