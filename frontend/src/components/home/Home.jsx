import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ThemeToggle from '../common/ThemeToggle';
import LanguageSelector from '../common/LanguageSelector';

// ============================================================
// HOME / LANDING PAGE – formal professional design
// Landscape SVG backgrounds, refined typography, kept subtle
// animations (scroll reveal, count-up, gentle drift, shine).
// Supports dark/light theme + English/Amharic via i18n.
// ============================================================

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function useCountUp(target, duration = 1800) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(Math.round(target * eased));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, duration]);

  return [ref, value];
}

function Counter({ end, suffix = '', duration = 1800 }) {
  const [ref, value] = useCountUp(end, duration);
  return (
    <div ref={ref} className="num">
      {value}
      {suffix}
    </div>
  );
}

function Home({ onLogin, isOnline }) {
  useScrollReveal();
  const { t, i18n } = useTranslation();
  const [showTop, setShowTop] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 600);
      setScrolled(window.scrollY > 24);
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const features = [
    { icon: '📡', title: t('home.feat_1_title'), desc: t('home.feat_1_desc') },
    { icon: '🔄', title: t('home.feat_2_title'), desc: t('home.feat_2_desc') },
    { icon: '🆔', title: t('home.feat_3_title'), desc: t('home.feat_3_desc') },
    { icon: '📋', title: t('home.feat_4_title'), desc: t('home.feat_4_desc') },
    { icon: '🛡️', title: t('home.feat_5_title'), desc: t('home.feat_5_desc') },
    { icon: '📊', title: t('home.feat_6_title'), desc: t('home.feat_6_desc') },
  ];

  const steps = [
    { step: '01', title: t('home.step_1_title'), desc: t('home.step_1_desc') },
    { step: '02', title: t('home.step_2_title'), desc: t('home.step_2_desc') },
    { step: '03', title: t('home.step_3_title'), desc: t('home.step_3_desc') },
  ];

  const values = [
    { icon: '🌐', title: t('home.value_1_title'), desc: t('home.value_1_desc') },
    { icon: '🔒', title: t('home.value_2_title'), desc: t('home.value_2_desc') },
    { icon: '⚡', title: t('home.value_3_title'), desc: t('home.value_3_desc') },
  ];

  const highlights = [
    t('home.hl_secure'),
    t('home.hl_offline'),
    t('home.hl_sync'),
    t('home.hl_report'),
    t('home.hl_location'),
    t('home.hl_tracking'),
  ];

  return (
    <div className="home-page" id="top">
      <style>{`
        .home-page {
          min-height: 100vh;
          background: var(--page-bg);
          color: var(--ink-soft);
          font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          scroll-behavior: smooth;
          --gold: #b8860b;
          --navy: #1e3a5f;
          --navy-dark: #14213d;
          --surface: #f8f4ea;
          --surface-soft: #efe8d8;
          --border: #e2dac6;
          --muted: #5d6472;
          --ink-soft: #2a3550;
          --green: var(--fs-green);
          --page-bg: #f3ede1;
        }

        /* ===== NAVBAR ===== */
        .home-nav {
          position: sticky;
          top: 0;
          z-index: 60;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 40px;
          background: var(--navy-dark);
          border-bottom: 1px solid rgba(230,193,90,0.22);
          box-shadow: ${scrolled ? '0 2px 14px rgba(20,33,61,0.35)' : 'none'};
          transition: box-shadow 0.3s ease;
        }
        .home-nav-brand { display: flex; align-items: center; gap: 12px; text-decoration: none; }
        .home-nav-logo {
          width: 40px; height: 40px; border-radius: 10px;
          background: linear-gradient(145deg, var(--gold), #e6c15a);
          display: flex; align-items: center; justify-content: center;
          color: var(--navy-dark); font-size: 18px; font-weight: 800; letter-spacing: 0.5px;
        }
        .home-nav-name { font-size: 19px; font-weight: 700; color: #fff; letter-spacing: 0.3px; }
        .home-nav-sub { font-size: 10px; color: rgba(255,255,255,0.6); letter-spacing: 1.4px; text-transform: uppercase; }
        .home-nav-links { display: flex; align-items: center; gap: 22px; }
        .home-nav-links a {
          text-decoration: none; color: rgba(255,255,255,0.75); font-size: 14px; font-weight: 600;
          position: relative; transition: color 0.25s ease;
        }
        .home-nav-links a::after {
          content: ''; position: absolute; left: 0; bottom: -4px;
          width: 0; height: 2px; border-radius: 2px;
          background: var(--gold); transition: width 0.3s ease;
        }
        .home-nav-links a:hover { color: #e6c15a; }
        .home-nav-links a:hover::after { width: 100%; }
        .home-nav-controls { display: flex; align-items: center; gap: 10px; }

        /* ===== BUTTONS ===== */
        .home-btn {
          position: relative; overflow: hidden;
          display: inline-flex; align-items: center; gap: 8px;
          padding: 11px 26px; border: none; border-radius: 8px;
          font-size: 15px; font-weight: 600; cursor: pointer;
          transition: all 0.25s ease; text-decoration: none;
        }
        .home-btn::after {
          content: ''; position: absolute; top: 0; left: -130%;
          width: 60%; height: 100%;
          background: linear-gradient(105deg, transparent, rgba(255,255,255,0.3), transparent);
          transform: skewX(-20deg);
        }
        .home-btn:hover::after { animation: shine 0.9s ease; }
        @keyframes shine { to { left: 150%; } }
        .home-btn-primary { background: var(--gold); color: #fff; }
        .home-btn-primary:hover { background: #a9861f; transform: translateY(-2px); box-shadow: 0 10px 24px rgba(184,134,11,0.35); }
        .home-btn-gold { background: var(--gold); color: #fff; }
        .home-btn-gold:hover { background: #a9861f; transform: translateY(-2px); box-shadow: 0 10px 24px rgba(201,162,39,0.3); }
        .home-btn-outline { background: transparent; color: var(--navy); border: 1.5px solid var(--navy); }
        .home-btn-outline:hover { background: rgba(30,58,95,0.06); }
        .home-btn-light-outline { background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,0.55); }
        .home-btn-light-outline:hover { background: rgba(255,255,255,0.12); }

        /* ===== HERO (full-screen rural landscape background) ===== */
        .home-hero {
          position: relative; overflow: hidden;
          min-height: 100vh;
          background: linear-gradient(180deg, #101c33 0%, #1e3a5f 60%, #2c5b8a 100%);
          color: #fff;
        }
        .home-hero-landscape {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; object-position: center; display: block;
        }
        .home-hero-shade {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(16,28,51,0.6) 0%, rgba(16,28,51,0.3) 40%, rgba(16,28,51,0.35) 60%, rgba(16,28,51,0.72) 100%);
          pointer-events: none;
        }
        .home-hero-inner {
          position: relative; z-index: 2;
          max-width: 1200px; margin: 0 auto;
          min-height: 100vh;
          padding: 96px 40px;
          text-align: center;
          display: flex; flex-direction: column;
          justify-content: center; align-items: center;
        }
        .home-hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 16px; border-radius: 999px;
          background: rgba(16,28,51,0.55);
          border: 1px solid rgba(255,255,255,0.25);
          font-size: 12px; font-weight: 600; letter-spacing: 0.8px; text-transform: uppercase;
          color: ${isOnline ? '#a7f3d0' : '#fecaca'};
        }
        .home-hero-eyebrow-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: currentColor; animation: home-pulse 1.4s ease-in-out infinite;
        }
        @keyframes home-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.75); } }
        .home-hero h1 {
          font-size: 46px; line-height: 1.18; font-weight: 800; color: #fff;
          letter-spacing: -0.5px; margin: 22px 0 0;
          font-family: 'Montserrat', 'Segoe UI', sans-serif;
          text-shadow: 0 2px 24px rgba(10,18,34,0.55);
        }
        .home-hero h1 .gold {
          color: #e6c15a;
          text-shadow: 0 2px 24px rgba(10,18,34,0.6);
        }
        .home-hero .lead {
          margin: 20px auto 32px; font-size: 17px; color: rgba(255,255,255,0.88);
          max-width: 680px; line-height: 1.7; font-weight: 400;
          text-shadow: 0 1px 18px rgba(10,18,34,0.6);
        }
        .home-hero-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
        .anim-enter { animation: fade-in-up 0.8s cubic-bezier(0.22,1,0.36,1) both; }
        .d1 { animation-delay: 0.15s; } .d2 { animation-delay: 0.3s; } .d3 { animation-delay: 0.45s; }
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }

        /* ===== TRUST STRIP ===== */
        .home-strip {
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          padding: 16px 40px;
        }
        .home-strip-inner {
          max-width: 1200px; margin: 0 auto;
          display: flex; align-items: center; justify-content: center; gap: 40px; flex-wrap: wrap;
        }
        .home-strip-item { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 13px; font-weight: 600; }
        .home-strip-item span { color: var(--gold); font-size: 16px; }

        /* ===== STATS ===== */
        .home-stats {
          background: linear-gradient(145deg, var(--navy-dark) 0%, var(--navy) 100%);
          padding: 52px 40px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
        }
        .home-stat { text-align: center; color: #fff; padding: 8px; }
        .home-stat .num { font-size: 40px; font-weight: 800; color: #e6c15a; font-family: 'Montserrat', 'Segoe UI', sans-serif; }
        .home-stat .lbl { font-size: 13px; color: #cbd5e1; margin-top: 6px; letter-spacing: 0.6px; text-transform: uppercase; }

        /* ===== SECTIONS ===== */
        .home-section { max-width: 1200px; margin: 0 auto; padding: 84px 40px; scroll-margin-top: 80px; }
        .home-section h2 { font-size: 34px; font-weight: 800; color: var(--navy); text-align: center; font-family: 'Montserrat', 'Segoe UI', sans-serif; letter-spacing: -0.3px; }
        .home-section .sub { text-align: center; color: var(--muted); margin: 12px auto 48px; max-width: 640px; font-size: 15px; line-height: 1.6; }
        .home-overline {
          text-align: center; color: var(--gold); font-size: 12px; font-weight: 700;
          letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;
        }
        .reveal { opacity: 0; transform: translateY(30px); transition: opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1); }
        .reveal.revealed { opacity: 1; transform: none; }

        /* ===== FEATURES ===== */
        .home-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .home-feature {
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 28px;
          transition: all 0.3s ease; position: relative; overflow: hidden;
        }
        .home-feature::before {
          content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 3px;
          background: linear-gradient(90deg, var(--gold), #4fc3f7);
          transform: scaleX(0); transform-origin: left; transition: transform 0.35s ease;
        }
        .home-feature:hover::before { transform: scaleX(1); }
        .home-feature:hover { transform: translateY(-5px); box-shadow: 0 16px 36px rgba(20,33,61,0.1); border-color: rgba(201,162,39,0.5); }
        .home-feature .ic {
          width: 52px; height: 52px; border-radius: 10px;
          background: linear-gradient(145deg, rgba(201,162,39,0.14), rgba(79,195,247,0.14));
          display: flex; align-items: center; justify-content: center;
          font-size: 26px; margin-bottom: 16px;
        }
        .home-feature h4 { font-size: 16px; font-weight: 700; color: var(--navy); margin: 0 0 8px; }
        .home-feature p { font-size: 14px; color: var(--muted); line-height: 1.65; margin: 0; }

        /* ===== STEPS ===== */
        .home-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; counter-reset: step; }
        .home-step {
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 30px;
          position: relative; transition: all 0.3s ease;
        }
        .home-step .no {
          font-size: 16px; font-weight: 800; color: var(--gold);
          background: rgba(201,162,39,0.12); width: 50px; height: 50px;
          display: flex; align-items: center; justify-content: center; border-radius: 10px;
          border: 1px solid rgba(201,162,39,0.3);
        }
        .home-step h4 { font-size: 16px; font-weight: 700; color: var(--navy); margin: 14px 0 8px; }
        .home-step p { font-size: 14px; color: var(--muted); line-height: 1.65; margin: 0; }
        .home-step:hover { transform: translateY(-5px); box-shadow: 0 16px 36px rgba(20,33,61,0.1); }

        /* ===== ABOUT ===== */
        .home-about { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
        .home-about-card {
          background: linear-gradient(145deg, var(--navy-dark), var(--navy));
          border-radius: 14px; padding: 36px; color: #fff; position: relative; overflow: hidden;
        }
        .home-about-card::before {
          content: ''; position: absolute; top: -40%; right: -30%; width: 260px; height: 260px;
          border-radius: 50%; background: rgba(201,162,39,0.18); filter: blur(30px);
        }
        .home-about-card h3 { font-size: 20px; font-weight: 800; color: #e6c15a; margin-bottom: 14px; font-family: 'Montserrat', 'Segoe UI', sans-serif; }
        .home-about-card p { font-size: 14px; line-height: 1.75; color: #e2e8f0; margin: 0; }
        .home-about-card .badge {
          display: inline-flex; align-items: center; gap: 8px; margin-top: 18px;
          padding: 6px 16px; border-radius: 999px; background: rgba(230,193,90,0.16);
          border: 1px solid rgba(230,193,90,0.35);
          color: #e6c15a; font-size: 13px; font-weight: 600;
        }
        .home-values { display: grid; gap: 16px; }
        .home-value {
          display: flex; gap: 14px; background: var(--surface); border: 1px solid var(--border);
          border-radius: 12px; padding: 18px; transition: all 0.3s ease;
        }
        .home-value:hover { transform: translateX(8px); border-color: var(--gold); box-shadow: 0 8px 20px rgba(201,162,39,0.12); }
        .home-value .vic { width: 44px; height: 44px; border-radius: 10px; background: rgba(201,162,39,0.12); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
        .home-value h4 { font-size: 15px; font-weight: 700; color: var(--navy); margin: 0 0 4px; }
        .home-value p { font-size: 13px; color: var(--muted); line-height: 1.6; margin: 0; }

        /* ===== CONTACT ===== */
        .home-contact-grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 36px; }
        .home-contact-cards { display: grid; gap: 16px; align-content: start; }
        .home-contact-card {
          display: flex; align-items: center; gap: 14px; background: var(--surface);
          border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px;
          transition: all 0.3s ease;
        }
        .home-contact-card:hover { transform: translateY(-4px); box-shadow: 0 10px 24px rgba(20,33,61,0.08); }
        .home-contact-card .cic {
          width: 46px; height: 46px; border-radius: 10px; flex-shrink: 0;
          background: linear-gradient(145deg, var(--navy), #4fc3f7);
          color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px;
        }
        .home-contact-card h4 { font-size: 14px; font-weight: 700; color: var(--navy); margin: 0; }
        .home-contact-card p { font-size: 13px; color: var(--muted); margin: 2px 0 0; }
        .home-contact-form {
          background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
          padding: 30px; box-shadow: 0 10px 30px rgba(20,33,61,0.06);
        }
        .home-contact-form h3 { font-size: 18px; font-weight: 800; color: var(--navy); margin: 0 0 4px; font-family: 'Montserrat', 'Segoe UI', sans-serif; }
        .home-contact-form .fs { font-size: 13px; color: var(--muted); margin: 0 0 20px; }
        .home-social-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: 14px;
          padding: 30px; box-shadow: 0 10px 30px rgba(20,33,61,0.06);
        }
        .home-social-card h3 { font-size: 18px; font-weight: 800; color: var(--navy); margin: 0 0 4px; font-family: 'Montserrat', 'Segoe UI', sans-serif; }
        .home-social-card .fs { font-size: 13px; color: var(--muted); margin: 0 0 20px; }
        .home-social-row { display: flex; gap: 12px; }
        .home-social-btn {
          flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px; border: 1px solid var(--border); border-radius: 10px;
          background: var(--surface-soft); color: var(--navy); text-decoration: none;
          font-size: 13px; font-weight: 600; transition: all 0.25s ease;
        }
        .home-social-btn svg { flex-shrink: 0; }
        .home-social-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 22px rgba(20,33,61,0.12); }
        .home-social-btn.youtube:hover { background: #ff0000; color: #fff; border-color: #ff0000; }
        .home-social-btn.facebook:hover { background: #1877f2; color: #fff; border-color: #1877f2; }
        .home-social-btn.twitter:hover { background: #1da1f2; color: #fff; border-color: #1da1f2; }
        .home-social-address { margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border); }
        .home-social-address h4 { font-size: 14px; font-weight: 700; color: var(--navy); margin: 0 0 6px; }
        .home-social-address p { font-size: 13px; color: var(--muted); line-height: 1.6; margin: 0; }
        .home-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .home-input {
          width: 100%; padding: 12px 14px; border: 1.5px solid var(--border); border-radius: 8px;
          font-size: 14px; font-family: inherit; box-sizing: border-box; background: var(--fs-input-bg);
          color: var(--fs-ink);
          transition: border-color 0.2s ease, box-shadow 0.2s ease; margin-bottom: 14px;
        }
        .home-input:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px rgba(201,162,39,0.14); }
        textarea.home-input { resize: vertical; min-height: 110px; }
        .contact-success {
          margin-top: 14px; padding: 12px 16px; border-radius: 8px;
          background: #d1fae5; color: #065f37; font-size: 14px; font-weight: 600;
          animation: fade-in-up 0.5s ease both;
        }

        /* ===== CTA ===== */
        .home-cta {
          background: linear-gradient(120deg, var(--navy), var(--navy-dark)); color: #fff;
          border-radius: 16px; max-width: 1000px; margin: 0 auto 84px; padding: 52px;
          text-align: center; position: relative; overflow: hidden;
        }
        .home-cta::before {
          content: ''; position: absolute; top: -60%; width: 60%; height: 220%;
          background: linear-gradient(105deg, transparent, rgba(255,255,255,0.06), transparent);
          transform: rotate(15deg); animation: cta-sweep 7s ease-in-out infinite;
        }
        @keyframes cta-sweep { 0%,100% { left: -30%; } 50% { left: 130%; } }
        .home-cta h3 { font-size: 28px; font-weight: 800; position: relative; font-family: 'Montserrat', 'Segoe UI', sans-serif; }
        .home-cta p { color: #cbd5e1; margin: 12px 0 26px; font-size: 15px; position: relative; }

        /* ===== FOOTER ===== */
        .home-footer { background: var(--navy-dark); color: #cbd5e1; padding: 32px 40px; }
        .home-footer-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; }
        .home-footer-links { display: flex; gap: 18px; }
        .home-footer-links a { color: #cbd5e1; text-decoration: none; font-size: 13px; transition: color 0.2s ease; }
        .home-footer-links a:hover { color: #e6c15a; }
        .home-footer strong { color: #fff; }

        /* ===== BACK TO TOP ===== */
        .home-top-btn {
          position: fixed; bottom: 24px; right: 24px; width: 44px; height: 44px;
          border-radius: 50%; background: var(--gold); color: #fff; border: none; font-size: 18px;
          cursor: pointer; box-shadow: 0 6px 18px rgba(201,162,39,0.4); z-index: 70;
          opacity: 0; visibility: hidden; transform: translateY(12px); transition: all 0.3s ease;
        }
        .home-top-btn.show { opacity: 1; visibility: visible; transform: none; }
        .home-top-btn:hover { background: #a9861f; transform: translateY(-2px); }

        /* ===== DARK THEME ADJUSTMENTS ===== */
        [data-theme='dark'] .home-page {
          --navy: #2b4a77;
          --navy-dark: #0f172a;
          --surface: #1a2440;
          --surface-soft: #16203a;
          --border: #2b3856;
          --muted: #9fb0c6;
          --ink-soft: #eef2f8;
          --page-bg: #0f172a;
        }
        [data-theme='dark'] .home-nav { box-shadow: 0 2px 12px rgba(0,0,0,0.3); }
        [data-theme='dark'] .home-nav-links a:hover { color: #e6c15a; }

        @media (max-width: 900px) {
          .home-features, .home-steps, .home-about, .home-contact-grid { grid-template-columns: 1fr; }
          .home-stats { grid-template-columns: repeat(2, 1fr); }
          .home-nav { padding: 12px 20px; flex-wrap: wrap; }
          .home-nav-links { gap: 14px; flex-wrap: wrap; }
          .home-section { padding: 56px 24px; }
          .home-hero-inner { padding: 80px 24px; min-height: 100vh; }
          .home-hero h1 { font-size: 32px; }
          .home-form-row { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ===== NAVBAR ===== */}
      <nav className="home-nav">
        <a className="home-nav-brand" href="#top">
          <div className="home-nav-logo">FS</div>
          <div>
            <div className="home-nav-name">FieldSync</div>
            <div className="home-nav-sub">Field Operations &amp; National ID</div>
          </div>
        </a>
        <div className="home-nav-links">
          <a href="#features">{t('home.nav_features')}</a>
          <a href="#how">{t('home.nav_how')}</a>
          <a href="#about">{t('home.nav_about')}</a>
          <a href="#contact">{t('home.nav_contact')}</a>
        </div>
        <div className="home-nav-controls">
          <LanguageSelector />
          <ThemeToggle />
          <button className="home-btn home-btn-primary" onClick={onLogin}>
            {t('home.sign_in')} →
          </button>
        </div>
      </nav>

      {/* ===== HERO (real landscape photo) ===== */}
      <section className="home-hero">
        <img
          className="home-hero-landscape"
          src={`${import.meta.env.BASE_URL}images/hero.jpg`}
          alt="Field landscape with a modern digital-blue horizon"
          loading="eager"
        />
        <div className="home-hero-shade"></div>

        <div className="home-hero-inner">
          <div className="home-hero-eyebrow anim-enter">
            <span className="home-hero-eyebrow-dot"></span>
            {isOnline ? t('home.online_badge') : t('home.offline_badge')}
          </div>
          <h1 className="anim-enter d1">
            {t('home.hero_title_1')}<br />
            <span className="gold">{t('home.hero_title_2')}</span>
          </h1>
          <p className="lead anim-enter d2">{t('home.hero_lead')}</p>
          <div className="home-hero-actions anim-enter d3">
            <button className="home-btn home-btn-gold" onClick={onLogin}>{t('home.login_account')}</button>
            <a href="#features" className="home-btn home-btn-light-outline">{t('home.explore_features')} ↓</a>
          </div>
        </div>
      </section>

      {/* ===== TRUST STRIP ===== */}
      <div className="home-strip">
        <div className="home-strip-inner">
          <div className="home-strip-item"><span>✓</span> {t('home.hl_secure')}</div>
          <div className="home-strip-item"><span>✓</span> {t('home.hl_offline')}</div>
          <div className="home-strip-item"><span>✓</span> {t('home.hl_sync')}</div>
          <div className="home-strip-item"><span>✓</span> {t('home.hl_report')}</div>
        </div>
      </div>

      {/* ===== STATS ===== */}
      <section className="home-stats">
        <div className="home-stat reveal">
          <Counter end={100} suffix="%" />
          <div className="lbl">{t('home.stat_offline')}</div>
        </div>
        <div className="home-stat reveal">
          <Counter end={24} suffix="/7" />
          <div className="lbl">{t('home.stat_sync')}</div>
        </div>
        <div className="home-stat reveal">
          <Counter end={3} />
          <div className="lbl">{t('home.stat_roles')}</div>
        </div>
        <div className="home-stat reveal">
          <Counter end={6} />
          <div className="lbl">{t('home.stat_levels')}</div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="home-section" id="features">
        <div className="home-overline reveal">{t('home.nav_features')}</div>
        <h2 className="reveal">{t('home.features_title')}</h2>
        <p className="sub reveal">{t('home.features_sub')}</p>
        <div className="home-features">
          {features.map((f, i) => (
            <div className="home-feature reveal" key={i} style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="ic">{f.icon}</div>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="home-section" id="how">
        <div className="home-overline reveal">{t('home.nav_how')}</div>
        <h2 className="reveal">{t('home.how_title')}</h2>
        <p className="sub reveal">{t('home.how_sub')}</p>
        <div className="home-steps">
          {steps.map((s, i) => (
            <div className="home-step reveal" key={i} style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="no">{s.step}</div>
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== ABOUT US ===== */}
      <section className="home-section" id="about">
        <div className="home-overline reveal">{t('home.nav_about')}</div>
        <h2 className="reveal">{t('home.about_title')}</h2>
        <p className="sub reveal">{t('home.about_sub')}</p>
        <div className="home-about">
          <div className="home-about-card reveal">
            <h3>{t('home.mission_title')}</h3>
            <p>{t('home.mission_p1')}</p>
            <p style={{ marginTop: 12 }}>{t('home.mission_p2')}</p>
            <div className="badge">
              <span className="home-hero-eyebrow-dot"></span>
              {t('home.trusted_badge')}
            </div>
          </div>
          <div className="home-values">
            {values.map((v, i) => (
              <div className="home-value reveal" key={i} style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="vic">{v.icon}</div>
                <div>
                  <h4>{v.title}</h4>
                  <p>{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONTACT ===== */}
      <section className="home-section" id="contact">
        <div className="home-overline reveal">{t('home.nav_contact')}</div>
        <h2 className="reveal">{t('home.contact_title')}</h2>
        <p className="sub reveal">{t('home.contact_sub')}</p>
        <div className="home-contact-grid">
          <div className="home-contact-cards">
            <div className="home-contact-card reveal">
              <div className="cic">📍</div>
              <div>
                <h4>{t('home.contact_office')}</h4>
                <p>{t('home.contact_office_val')}</p>
              </div>
            </div>
            <div className="home-contact-card reveal">
              <div className="cic">✉️</div>
              <div>
                <h4>{t('home.contact_email')}</h4>
                <p>{t('home.contact_email_val')}</p>
              </div>
            </div>
            <div className="home-contact-card reveal">
              <div className="cic">📞</div>
              <div>
                <h4>{t('home.contact_phone')}</h4>
                <p>{t('home.contact_phone_val')}</p>
              </div>
            </div>
            <div className="home-contact-card reveal">
              <div className="cic">🕒</div>
              <div>
                <h4>{t('home.contact_hours')}</h4>
                <p>{t('home.contact_hours_val')}</p>
              </div>
            </div>
          </div>
          <div className="home-social-card reveal">
            <h3>{t('home.follow_title')}</h3>
            <p className="fs">{t('home.follow_note')}</p>
            <div className="home-social-row">
              <a className="home-social-btn youtube" href="#" aria-label={t('home.follow_youtube')} title={t('home.follow_youtube')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/>
                </svg>
                <span>{t('home.follow_youtube')}</span>
              </a>
              <a className="home-social-btn facebook" href="#" aria-label={t('home.follow_facebook')} title={t('home.follow_facebook')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z"/>
                </svg>
                <span>{t('home.follow_facebook')}</span>
              </a>
              <a className="home-social-btn twitter" href="#" aria-label={t('home.follow_twitter')} title={t('home.follow_twitter')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.24 2.25h3.31l-7.23 8.26 8.51 11.24h-6.66l-5.22-6.82-5.97 6.82H1.66l7.73-8.84L1.25 2.25h6.83l4.72 6.24 5.44-6.24zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z"/>
                </svg>
                <span>{t('home.follow_twitter')}</span>
              </a>
            </div>
            <div className="home-social-address">
              <h4>{t('home.contact_office')}</h4>
              <p>{t('home.contact_office_val')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <div className="home-cta reveal">
        <h3>{t('home.cta_title')}</h3>
        <p>{t('home.cta_p')}</p>
        <button className="home-btn home-btn-gold" onClick={onLogin}>{t('home.cta_btn')}</button>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="home-footer">
        <div className="home-footer-inner">
          <p>© 2026 <strong>FieldSync</strong> — {t('home.footer_rights')}</p>
          <div className="home-footer-links">
            <a href="#features">{t('home.nav_features')}</a>
            <a href="#about">{t('home.nav_about')}</a>
            <a href="#contact">{t('home.nav_contact')}</a>
          </div>
        </div>
      </footer>

      {/* ===== BACK TO TOP ===== */}
      <button
        className={`home-top-btn${showTop ? ' show' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label={t('home.back_to_top')}
        title={t('home.back_to_top')}
      >
        ↑
      </button>
    </div>
  );
}

export default Home;
