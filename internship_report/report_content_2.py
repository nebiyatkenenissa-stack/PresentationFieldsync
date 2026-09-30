# -*- coding: utf-8 -*-
"""Sections: Chapter 3, Chapter 4, References."""

CHAPTER_3 = [
    ("h1", "CHAPTER THREE - BENEFITS GAINED FROM THE INTERNSHIP"),
    ("p", "The internship was not only a requirement for graduation; it was a learning experience that "
          "improved me as a student, as a developer and as a professional. This chapter explains the "
          "benefits I gained in terms of practical skills, theoretical knowledge, communication, teamwork, "
          "leadership, work ethics and entrepreneurship."),
    ("h2", "3.1 Improving Practical Skills"),
    ("p", "The most obvious benefit was the improvement of my practical programming skills. In the classroom I "
          "had written small programs and completed assignments, but at AFRICOM I worked on a large, "
          "production-style codebase with dozens of files, real data and real users. I improved my ability "
          "to write clean React components, to manage application state, to design relational database "
          "schemas, and to write parameterised SQL queries. I also learned tools and practices that cannot "
          "easily be taught in class, such as Git branching and pull requests, debugging with the browser "
          "developer tools, using the browser network panel to observe API traffic, and working with "
          "containerised services through Docker."),
    ("p", "I particularly improved in the areas of offline storage and data synchronisation. Before the "
          "internship I did not know what a service worker or an IndexedDB was; after the internship I could "
          "design a local data model, implement a sync queue, and handle retries and failures. This is a "
          "practical skill of great value in Ethiopia, where connectivity problems affect many applications."),
    ("h2", "3.2 Upgrading Theoretical Knowledge"),
    ("p", "The internship gave real meaning to theories I had learned in courses such as software engineering, "
          "network programming, data communication and human-computer interaction. For example, the concept "
          "of the three-tier architecture became concrete when I built the client, API and database layers "
          "of FieldSync and connected them together. The theory of database normalisation was confirmed when "
          "I designed tables and wrote joins, and the theory of distributed systems became real when I "
          "confronted the problem of keeping a local database and a server database consistent."),
    ("p", "I also learned several entirely new concepts that are not part of my regular coursework, including "
          "offline-first design, conflict resolution, progressive web applications, idempotency of write "
          "operations, exponential backoff for retries and internationalisation. To understand these ideas I "
          "read official documentation and technical articles, and I believe my theoretical understanding of "
          "modern web application design is now much stronger than before."),
    ("h2", "3.3 Improving Interpersonal Communication Skills"),
    ("p", "Working in a team with senior developers, a mentor and other interns forced me to communicate "
          "clearly all day long. I learned to explain technical problems in simple words, to listen carefully "
          "to instructions, and to ask precise questions when I did not understand something. The daily "
          "stand-up meetings were excellent practice: every day I had to summarise what I was doing in under "
          "a minute, which improved my ability to speak briefly and clearly. I also wrote documentation and "
          "investigation notes in English, which improved my written communication."),
    ("h2", "3.4 Improving Teamwork Skills"),
    ("p", "FieldSync was built by a team, and almost none of the features I worked on could be completed by "
          "one person alone. I learned to coordinate my changes with the work of other developers, to review "
          "other people's code without being rude, and to accept feedback about my own code without taking "
          "it personally. I also learned the value of sharing work: when I solved a difficult problem, "
          "showing the whole team how I solved it saved others time, and when someone else found a bug in my "
          "code, fixing it together made the system better. Teamwork, I now understand, is not only about "
          "dividing work but about combining knowledge."),
    ("h2", "3.5 Improving Leadership Skills"),
    ("p", "As an intern I had no formal leadership role, but the internship still helped me develop leadership "
          "qualities. On several occasions I was given a small feature and full responsibility for it, which "
          "required me to plan my own time, set small goals and take ownership of the result. When the "
          "project lead was busy, I also assisted the other intern with the parts of the project I had "
          "already mastered, which taught me to guide and encourage others. I learned that true leadership "
          "often means being dependable, helping your colleagues and taking responsibility under pressure."),
    ("h2", "3.6 Understanding Work Ethics"),
    ("p", "The internship showed me the professional values that govern a serious workplace. I learned the "
          "importance of arriving on time and respecting the working hours of others, of keeping promises "
          "and communicating early when a deadline is at risk, and of taking responsibility for the quality "
          "of my own code. I also observed how the company protects confidential information: the field data "
          "we handled belongs to real citizens, and the team treated it with care. The greatest lesson was "
          "honesty in reporting progress; in the stand-up meetings everyone reported exactly what was done, "
          "good or bad, because hiding a problem only makes it bigger."),
    ("h2", "3.7 Entrepreneurship Skills"),
    ("p", "Being inside AFRICOM, a company founded by young Ethiopian entrepreneurs, gave me a direct "
          "education in entrepreneurship. I observed how ideas become products: how the company listens to "
          "the problems of a client, prepares a proposal, estimates cost and time, forms a team and delivers "
          "a solution. I learned that small teams can build valuable systems and that trust with the client "
          "is more important than any single technology. I also began to appreciate the gap between an "
          "idea and a deliverable: the FieldSync project required planning, discipline and many small "
          "decisions long after the exciting part of the design was finished. This experience has encouraged "
          "me to consider starting my own software company one day, and it gave me a realistic idea of what "
          "that would require."),
    ("h2", "3.8 Chapter Summary"),
    ("p", "In summary, the internship provided benefits on several levels. I improved my practical development "
          "skills, upgraded my theoretical knowledge of modern web and offline-first systems, and developed "
          "my communication, teamwork and leadership abilities. I learned professional work ethics from "
          "direct experience, and I gained a realistic understanding of entrepreneurship in the Ethiopian "
          "technology sector. These benefits, taken together, have made me significantly more employable and "
          "more confident about my future."),
]

CHAPTER_4 = [
    ("h1", "CHAPTER FOUR - CONCLUSION AND RECOMMENDATIONS"),
    ("h2", "4.1 Conclusion"),
    ("p", "This internship report has presented my experience at AFRICOM Technologies PLC during the 2018 E.C. "
          "academic year. Over the course of the internship I contributed to the development of FieldSync, an "
          "offline-first registration and reporting system that helps government field officers register "
          "citizens and submit daily reports even where internet connectivity is poor. The system solves a "
          "real problem in Ethiopia, and the offline-first design that I helped implement is the technically "
          "most valuable part of my experience."),
    ("p", "During the internship I completed tasks that covered the full software development lifecycle: "
          "requirements analysis, system and database design, front-end development with React and Tailwind "
          "CSS, backend development with Express and PostgreSQL, the implementation of a robust offline "
          "synchronisation engine, GPS integration, support for four Ethiopian languages, testing and "
          "deployment preparation with Docker. In the process I improved my practical skills, deepened my "
          "theoretical understanding, and developed my communication, teamwork, leadership, work-ethic and "
          "entrepreneurship skills."),
    ("p", "The internship also taught me that software projects in reality are different from classroom "
          "projects. Requirements are never fully complete, networks fail, users behave in unexpected ways, "
          "and small bugs can have large consequences. Facing these realities during the internship, "
          "identifying the related problems and proposing solutions for them has prepared me for the "
          "professional world. On the whole, I consider the internship a complete success: the company "
          "gained a useful contribution to the FieldSync project, and I gained an education that no textbook "
          "could have provided."),
    ("h2", "4.2 Recommendations for the Company"),
    ("p", "Based on my observations during the internship, I would like to offer the following recommendations "
          "to AFRICOM Technologies PLC, and in particular to the FieldSync project team."),
    ("numbered", [
        "Adopt automated testing and continuous integration. Most of the testing during the internship was "
        "manual. Introducing unit tests for the synchronisation and validation logic and integration tests "
        "for the API, running automatically on every commit, would reduce the time spent on regression "
        "testing and increase the confidence of the team.",
        "Strengthen conflict resolution and data quality rules. The system already prevents exact duplicate "
        "citizen registrations; I recommend extending the duplicate check to phone numbers and dates of "
        "birth, and showing possible duplicate matches to the officer before a record is saved.",
        "Compress photo attachments before upload. Resizing and compressing images on the device reduces "
        "upload time and failure rate over weak connections, which is important for a field system.",
        "Keep the API documentation complete and generated from the code. Automated documentation such as "
        "OpenAPI keeps the endpoints accurate and helps new team members, including future interns, work "
        "independently more quickly.",
        "Give a structured onboarding to every intern. The walkthrough I received in my first week made an "
        "enormous difference. A short, written onboarding guide for the FieldSync repository would make the "
        "first days of any future intern more productive.",
        "Consider periodic security reviews. Because the system stores sensitive citizen data, I recommend "
        "regular reviews of passwords, server access and data backups, together with HTTPS everywhere and "
        "encrypted backups.",
        "Schedule a short demonstration for the university. Sharing successful internship projects with the "
        "university strengthens the partnership and encourages more students to apply.",
    ]),
    ("h2", "4.3 Concluding Remarks"),
    ("p", "I am grateful to Debre Berhan University and to AFRICOM Technologies PLC for making this internship "
          "possible. The experience has confirmed my decision to pursue a career in information technology, "
          "has given me practical abilities that will benefit my future employers, and has shown me that "
          "young Ethiopians can build world-class software. I hope that the cooperation between the "
          "university and the company will continue and grow, and that other students will have the same "
          "opportunity I had to learn in a real software company."),
]

REFERENCES = [
    ("h1", "REFERENCES"),
    ("ref", "AFRICOM Technologies PLC. (2024). About Us. AFRICOM Technologies. Retrieved from https://africom.et/about"),
    ("ref", "AFRICOM Technologies PLC. (2024). GovTech Solutions. AFRICOM Technologies. Retrieved from https://africom.et/services/govtech-solutions"),
    ("ref", "AFRICOM Technologies PLC. (2024). BPO Services. AFRICOM Technologies. Retrieved from https://africom.et/services/bpo"),
    ("ref", "AFRICOM Technologies PLC. (2024). E-commerce Solutions. AFRICOM Technologies. Retrieved from https://africom.et/services/ecommerce-solutions"),
    ("ref", "Dexie.js. (2024). Dexie.js - A Minimalistic Wrapper for IndexedDB. Retrieved from https://dexie.org"),
    ("ref", "Duckett, J. (2014). JavaScript and JQuery: Interactive Front-End Web Development. Wiley."),
    ("ref", "Express.js. (2024). Express - Node.js web application framework. Retrieved from https://expressjs.com"),
    ("ref", "Flanagan, D. (2020). JavaScript: The Definitive Guide (7th ed.). O'Reilly Media."),
    ("ref", "Mozilla Developer Network. (2024). IndexedDB API. MDN Web Docs. Retrieved from https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API"),
    ("ref", "Mozilla Developer Network. (2024). Progressive web apps. MDN Web Docs. Retrieved from https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps"),
    ("ref", "Node.js. (2024). Node.js Documentation. Retrieved from https://nodejs.org/en/docs"),
    ("ref", "PostgreSQL. (2024). PostgreSQL Documentation. Retrieved from https://www.postgresql.org/docs"),
    ("ref", "React. (2024). React Documentation. Retrieved from https://react.dev"),
    ("ref", "Recharts. (2024). Recharts - a composable charting library built on React components. Retrieved from https://recharts.org"),
    ("ref", "Silver, H. (2023). Tailwind CSS documentation. Retrieved from https://tailwindcss.com/docs"),
    ("ref", "The i18next project. (2024). i18next Documentation. Retrieved from https://www.i18next.com"),
    ("ref", "Vite. (2024). Vite - Next Generation Frontend Tooling. Retrieved from https://vitejs.dev"),
]