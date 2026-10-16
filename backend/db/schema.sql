--
-- FieldSync schema.
--
-- Generated with pg_dump 18 and applied automatically by the `db` service on
-- first start (mounted into /docker-entrypoint-initdb.d/). It contains schema
-- only - no demo or seed data - so it is safe to commit.
--
-- Two pg_dump-18-only constructs were removed so the file runs on the
-- postgres:16-alpine image the stack uses:
--   \restrict / \unrestrict  (psql 18 meta-commands, unknown to psql 16)
--   SET transaction_timeout  (a PostgreSQL 17+ setting)
--
-- Note on users.role: the column is a plain varchar(50) with no CHECK
-- constraint, so the application decides which values are valid. The roles in
-- use are 'admin', 'manager', 'supervisor' and 'field_officer'. No migration
-- is needed to add the 'admin' role.
--

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    priority character varying(50) DEFAULT 'medium'::character varying,
    type character varying(50) DEFAULT 'emergency'::character varying,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    read boolean DEFAULT false,
    target_all boolean DEFAULT true,
    target_employee_id character varying(255),
    sent_by character varying(255) NOT NULL,
    sent_by_name character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    target_users jsonb,
    sent_by_role character varying(50)
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id character varying(255) NOT NULL,
    user_id character varying(255) NOT NULL,
    user_name character varying(255) NOT NULL,
    action character varying(255) NOT NULL,
    details text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    ip character varying(50)
);


--
-- Name: citizens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.citizens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    national_id character varying(50) NOT NULL,
    first_name character varying(50) NOT NULL,
    last_name character varying(50) NOT NULL,
    date_of_birth date,
    gender character varying(20),
    phone character varying(20),
    email character varying(100),
    address text,
    region text,
    district text,
    village text,
    occupation character varying(100),
    marital_status character varying(20),
    registration_date date,
    registered_by character varying(50),
    registered_by_name character varying(100),
    id_type character varying(50),
    id_number character varying(50),
    biometrics boolean DEFAULT false,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone,
    photo text,
    latitude double precision,
    longitude double precision,
    gps_accuracy double precision,
    gps_captured_at timestamp without time zone,
    grandfather_name text,
    father_name text,
    mother_name text,
    birth_place text,
    birth_certificate_number character varying(100)
);


--
-- Name: communities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.communities (
    id integer CONSTRAINT communities_id_not_null1 NOT NULL,
    name character varying(100) CONSTRAINT communities_name_not_null1 NOT NULL,
    kebele_id integer CONSTRAINT communities_kebele_id_not_null1 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: communities_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.communities_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: communities_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.communities_id_seq OWNED BY public.communities.id;


--
-- Name: leaves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leaves (
    id text DEFAULT gen_random_uuid() NOT NULL,
    employee_id character varying(50) NOT NULL,
    employee_name character varying(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    type character varying(50),
    duration character varying(20) DEFAULT 'daily',
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approved_by character varying(100),
    approved_at timestamp without time zone,
    synced boolean DEFAULT true,
    updated_at timestamp without time zone
);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    level character varying(20) NOT NULL,
    parent_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT locations_level_check CHECK (((level)::text = ANY ((ARRAY['country'::character varying, 'region'::character varying, 'zone'::character varying, 'woreda'::character varying, 'kebele'::character varying, 'community'::character varying])::text[])))
);


--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id text DEFAULT gen_random_uuid() NOT NULL,
    employee_id character varying(50) NOT NULL,
    employee_name character varying(100) NOT NULL,
    permission_type character varying(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    shift character varying(20) DEFAULT 'morning',
    time_slot character varying(30),
    start_time time without time zone,
    end_time time without time zone,
    hours numeric(4,2),
    reason text,
    status character varying(20) DEFAULT 'pending'::character varying,
    requested_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approved_by character varying(100),
    approved_at timestamp without time zone,
    synced boolean DEFAULT true,
    updated_at timestamp without time zone,
    reject_reason text
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id character varying(50) NOT NULL,
    employee_id character varying(50) NOT NULL,
    employee_name character varying(100) NOT NULL,
    supervisor_id character varying(50),
    report_date date NOT NULL,
    region text,
    site_name character varying(100),
    registrations integer DEFAULT 0,
    operational_status character varying(50),
    attendance character varying(20),
    work_hours numeric(5,2),
    activities text,
    equipment_status character varying(50),
    materials_used character varying(255),
    team_members character varying(255),
    weather_conditions character varying(100),
    community_feedback text,
    challenges text,
    issues text,
    comments text,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    synced boolean DEFAULT true,
    reviewed boolean DEFAULT false,
    reviewed_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone,
    latitude double precision,
    longitude double precision,
    gps_accuracy double precision,
    gps_captured_at timestamp without time zone,
    attachments jsonb
);


--
-- Name: screen_time; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.screen_time (
    id character varying(255) NOT NULL,
    employee_id character varying(255) NOT NULL,
    employee_name character varying(255) NOT NULL,
    date date NOT NULL,
    login_time time without time zone,
    logout_time time without time zone,
    total_screen_time double precision DEFAULT 0,
    screen_time_limit double precision DEFAULT 28800,
    trust_score double precision DEFAULT 0,
    is_logged_in boolean DEFAULT false,
    verified boolean DEFAULT false,
    verified_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    idle_time integer DEFAULT 0,
    session_start timestamp without time zone
);


--
-- Name: supervisor_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supervisor_reports (
    id character varying(255) DEFAULT gen_random_uuid() NOT NULL,
    supervisor_id character varying(50) NOT NULL,
    supervisor_name character varying(100) NOT NULL,
    officer_id character varying(50),
    officer_name character varying(100),
    officer_region text,
    report_date date NOT NULL,
    performance character varying(20),
    attendance character varying(20),
    quality character varying(20),
    punctuality character varying(20),
    teamwork character varying(20),
    communication character varying(20),
    comments text,
    recommendations text,
    overall_rating integer,
    status character varying(20) DEFAULT 'submitted'::character varying,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    region text,
    type character varying(20),
    synced boolean DEFAULT true,
    site_visits integer,
    issues_resolved integer,
    challenges text,
    achievements text,
    team_morale character varying(50),
    resource_status character varying(50),
    overall_status character varying(50),
    verification_count integer,
    verification_passed integer,
    verification_score integer,
    verification_penalties integer,
    verification_notes text,
    screen_time_minutes integer,
    screen_time_idle_minutes integer,
    screen_time_trust_score integer,
    attachments jsonb
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id character varying(255) NOT NULL,
    employee_id character varying(255) NOT NULL,
    assigned_by character varying(255) NOT NULL,
    assigned_by_name character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    deadline date NOT NULL,
    priority character varying(50) DEFAULT 'medium'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying(50) DEFAULT gen_random_uuid() NOT NULL,
    employee_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(50) NOT NULL, -- admin | manager | supervisor | field_officer
    region text,
    supervisor_id character varying(50),
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    phone character varying(50),
    gender character varying(20),
    shift character varying(20) DEFAULT 'Day'::character varying,
    department character varying(100),
    profile_photo text,
    must_change_password boolean DEFAULT true,
    country_id integer,
    region_id integer,
    zone_id integer,
    woreda_id integer,
    kebele_id integer,
    community_id integer,
    location_path text,
    last_active timestamp with time zone DEFAULT now(),
    online_status character varying(20) DEFAULT 'offline'::character varying
);


--
-- Name: verification_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_history (
    id character varying(255) NOT NULL,
    officer_id character varying(255) NOT NULL,
    officer_name character varying(255) NOT NULL,
    question text NOT NULL,
    answer text,
    success boolean DEFAULT false,
    score integer DEFAULT 0,
    response_time integer DEFAULT 0,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    message text,
    penalties text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: communities id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities ALTER COLUMN id SET DEFAULT nextval('public.communities_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: citizens citizens_national_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citizens
    ADD CONSTRAINT citizens_national_id_key UNIQUE (national_id);


--
-- Name: citizens citizens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.citizens
    ADD CONSTRAINT citizens_pkey PRIMARY KEY (id);


--
-- Name: communities communities_name_kebele_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_name_kebele_id_key UNIQUE (name, kebele_id);


--
-- Name: communities communities_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_pkey1 PRIMARY KEY (id);


--
-- Name: leaves leaves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaves
    ADD CONSTRAINT leaves_pkey PRIMARY KEY (id);


--
-- Name: locations locations_name_parent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_name_parent_id_key UNIQUE (name, parent_id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: reports reports_report_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_report_id_key UNIQUE (report_id);


--
-- Name: screen_time screen_time_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screen_time
    ADD CONSTRAINT screen_time_pkey PRIMARY KEY (id);


--
-- Name: supervisor_reports supervisor_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supervisor_reports
    ADD CONSTRAINT supervisor_reports_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_employee_id_key UNIQUE (employee_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_history verification_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_history
    ADD CONSTRAINT verification_history_pkey PRIMARY KEY (id);


--
-- Name: idx_alerts_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_priority ON public.alerts USING btree (priority);


--
-- Name: idx_alerts_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alerts_timestamp ON public.alerts USING btree ("timestamp");


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_timestamp ON public.audit_logs USING btree ("timestamp");


--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);


--
-- Name: idx_screen_time_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_screen_time_date ON public.screen_time USING btree (date);


--
-- Name: idx_screen_time_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_screen_time_employee ON public.screen_time USING btree (employee_id);


--
-- Name: idx_tasks_employee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_employee_id ON public.tasks USING btree (employee_id);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);


--
-- Name: idx_verification_officer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_officer ON public.verification_history USING btree (officer_id);


--
-- Name: idx_verification_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_timestamp ON public.verification_history USING btree ("timestamp");


--
-- Name: communities communities_kebele_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.communities
    ADD CONSTRAINT communities_kebele_id_fkey FOREIGN KEY (kebele_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: locations locations_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.locations(id) ON DELETE CASCADE;


--
-- Name: users users_community_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_community_id_fkey FOREIGN KEY (community_id) REFERENCES public.communities(id) ON DELETE SET NULL;


--
-- Name: users users_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.locations(id);


--
-- Name: users users_kebele_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_kebele_id_fkey FOREIGN KEY (kebele_id) REFERENCES public.locations(id);


--
-- Name: users users_region_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_region_id_fkey FOREIGN KEY (region_id) REFERENCES public.locations(id);


--
-- Name: users users_woreda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_woreda_id_fkey FOREIGN KEY (woreda_id) REFERENCES public.locations(id);


--
-- Name: users users_zone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.locations(id);


--
-- PostgreSQL database dump complete
--

