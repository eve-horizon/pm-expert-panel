What We Want (High Level Summary)

We want to provide Linguard people with a painless way of surfacing information concerning Chivo 2.0 requirements, initially via Slack and Google Doc, so that we can turn it into properly curated and elaborated product requirements.

We want to provide both ourselves and Linguard with web-based tools for managing the captured artefacts.

We want to do both these things ASAP because of Chivo 2.0 / Linguard delivery pressures. 

However, these are just the very first steps towards a wider-ranging product vision (that is not unique to Chivo or Linguard). We want this initial build to be laying foundations for that as much as possible.

Longer-Term Vision

Broadly, this encompasses:
Extraction: generating user journeys, features, stories and ACs that are derived and synthesized from the captured artefacts.
Change management: updating these user journeys on receipt of new information
Multi-channel: requirement artefact capture encompassing video, voice/audio, image, etc.
Feedback loop to users/SMEs: generation of questions based on ingested artefacts and resultant requirements, and propagation of these questions back to originating user(s) and/or human product manager/product owner. This is the primary use case where the multi-disciplined ‘panel’ of different AI personas kicks in (UI/UX, Back-End, QA, DevOps, InfoSec, Product etc.)
Response handling: matching user answers to questions raised
Manual user journey/story/AC manipulation through web UI
Release composition: user arranges features from the various user journeys into candidate releases preparatory to requesting <whatever dev agent> to build.

Flows (Right Now / “Phase 1”)

Setup
‘Seed’ the system with initial context
Tell it (with e.g. 1-2 pages) what you’re building, for whom and why
Give it enough to allow it to formulate the user journeys it will bucket stuff under when the hosepipe is turned on and artefacts start arriving. No more detail than this is necessary at this stage. Activities, steps, tasks can all wait until “post-MVP”.
Document Ingestion
User posts document to Slack or in Google Drive
System ingests, assesses where it belongs, tags it
If it can’t figure out which bucket to put it in (and any given doc may be relevant to more than one user journey) then flag it up for human attention - meaning put it in a queue that a ‘Product Manager’ user will see and where they will be able to direct the artefact to the right bucket(s).
Simple Web UI
User logs in (yes, authentication needed, plus we will want at least two levels of access - users who can mess with stuff and users who are view-only)
User sees Buckets containing ingested artefacts
User can view ingested artefact(s)
Product Manager user sees queue of un-bucketable artefacts and can work through them assigning them as he/she sees fit.

Flows (Following on from initial release above)

Story Mapping
Moving on from simple ingestion and display - the system will be able to generate activities, steps, tasks - story-mapping as per preVIBE prototyping.
Ingested artefacts will now be assessed not just to figure out where they fit but also to determine if they are supportive of, additive to or conflicting with existing user journeys.
The “Panel of Experts” is invoked to give each story a good kicking from the perspectives of Product, UI/UX, Back-End, QA etc.
Conflicts and questions will be surfaced in the UI and signalled to the Product Manager human(s). We could automatically fire questions back at originating human users, but that would entail keeping track somehow of which human users were interested in or associated with each artefact, and also tracking which stories every artefact had impacted.
Additional Channels
Add the ability to ingest artefacts rendered as video and/or audio
Ingest diagrams (if not already handled by MVP)
Handoff to Delivery
Integrate with other components of Eve responsible for engineering and delivery
Gate progression to this stage on number/level of remaining open questions
System must ensure that release composition is coherent (must have some idea of dependencies, for example)
