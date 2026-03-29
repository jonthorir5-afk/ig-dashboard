import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function LandingPage({ linkData }) {
  const [showPopup, setShowPopup] = useState(false);

  // Fallback to default if no linkData provided
  const {
    profileImage = 'https://i.imgur.com/ghzWmXu.jpeg',
    ofCardImage = 'https://i.imgur.com/lUxXtCr.png',
    creatorName = 'Ariana',
    username = '@username',
    onlyFansUrl = 'https://onlyfans.com/arianaangelsxo/c90',
    metaPixelId = '693023723805931',
    linkId = 'default'
  } = linkData || {};

  useEffect(() => {
    // Initialize Meta Pixel
    if (typeof window !== 'undefined' && metaPixelId !== 'YOUR_PIXEL_ID_HERE') {
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () {
          n.callMethod ?
            n.callMethod.apply(n, arguments) : n.queue.push(arguments)
        };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
        n.queue = []; t = b.createElement(e); t.async = !0;
        t.src = v; s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s)
      }(window, document, 'script',
        'https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', metaPixelId);
      window.fbq('track', 'PageView');
    }
  }, [metaPixelId]);

  const handleOFClick = (e) => {
    e.preventDefault();
    setShowPopup(true);
  };

  const handleContinue = async () => {
    // Fire Meta Pixel Purchase event
    if (window.fbq) {
      window.fbq('track', 'Purchase', {
        value: 1.00,
        currency: 'USD',
        content_name: 'OnlyFans Link Click',
      });
    }

    // Fire webhook to update the Google Sheet tracking
    try {
      await fetch('/api/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkId,
          creatorName,
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) {
      console.error("Failed to track click:", e);
    }

    // Navigate to OnlyFans
    window.open(onlyFansUrl, '_blank');
    setShowPopup(false);
  };

  const handleCancel = () => {
    setShowPopup(false);
  };

  return (
    <>
      <Head>
        <title>{creatorName} - Links</title>
        <meta name="description" content={`Visit ${creatorName}'s link`} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div
        style={{
          minHeight: '100vh',
          background: '#2b2d42',
          backgroundImage: `linear-gradient(rgba(43, 45, 66, 0.85), rgba(43, 45, 66, 0.85)), url(${profileImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '600px',
            width: '100%',
            padding: '40px 20px 20px',
          }}
        >
          {/* Profile Header Card */}
          <div
            style={{
              position: 'relative',
              borderRadius: '24px',
              overflow: 'hidden',
              marginBottom: '20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Background Image */}
            <div
              style={{
                width: '100%',
                height: '400px',
                backgroundImage: `url(${profileImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            {/* Purple Gradient Overlay */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '60%',
                background:
                  'linear-gradient(to top, rgba(106, 90, 205, 0.9) 0%, rgba(106, 90, 205, 0.6) 50%, transparent 100%)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '32px 24px',
              }}
            >
              <h1
                style={{
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '42px',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: '0 0 8px 0',
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                  letterSpacing: '-0.02em',
                }}
              >
                {creatorName}
              </h1>

              <p
                style={{
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '16px',
                  color: 'rgba(255, 255, 255, 0.95)',
                  margin: '0 0 16px 0',
                  textShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
                }}
              >
                {username}
              </p>

              {/* Social Icons */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                }}
              >
                {/* OnlyFans Icon (generic link icon) */}
                <a
                  href={onlyFansUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                </a>

                {/* Link.me Badge (kept as-is) */}
                <a
                  href="#"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#6a5acd',
                    textDecoration: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  me
                </a>
              </div>
            </div>
          </div>

          {/* Main OF Link Card */}
          <a
            href="#"
            onClick={handleOFClick}
            style={{
              position: 'relative',
              display: 'block',
              height: '280px',
              borderRadius: '20px',
              overflow: 'hidden',
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.3s ease',
              marginBottom: '32px',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
            }}
          >
            {/* Background Image */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: `url(${ofCardImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            {/* Purple Gradient Overlay */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background:
                  'linear-gradient(135deg, rgba(106, 90, 205, 0.75) 0%, rgba(138, 43, 226, 0.65) 100%)',
              }}
            />

            {/* Link Icon */}
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>

            {/* Title */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '32px 24px',
                textAlign: 'center',
              }}
            >
              <h2
                style={{
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '32px',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: 0,
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                  letterSpacing: '-0.01em',
                }}
              >
                See more of me 🔥
              </h2>
            </div>
          </a>

          {/* Footer */}
          <div
            style={{
              textAlign: 'center',
              padding: '20px 0 40px',
            }}
          >
            <p
              style={{
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.5)',
                margin: 0,
              }}
            >
              <a
                href="#"
                style={{
                  color: 'inherit',
                  textDecoration: 'none',
                  marginRight: '12px',
                }}
              >
                Privacy Policy
              </a>
              |
              <a
                href="#"
                style={{
                  color: 'inherit',
                  textDecoration: 'none',
                  margin: '0 12px',
                }}
              >
                Terms
              </a>
              |
              <a
                href="#"
                style={{
                  color: 'inherit',
                  textDecoration: 'none',
                  marginLeft: '12px',
                }}
              >
                Report
              </a>
            </p>
          </div>
        </div>

        {/* Confirmation Popup */}
        {showPopup && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
            }}
            onClick={handleCancel}
          >
            <div
              style={{
                background: '#1a1d2e',
                borderRadius: '24px',
                padding: '40px 32px',
                maxWidth: '380px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Icon */}
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  margin: '0 auto 24px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>

              <h2
                style={{
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: '0 0 12px 0',
                }}
              >
                Are you sure?
              </h2>

              <p
                style={{
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '15px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  margin: '0 0 32px 0',
                  lineHeight: '1.5',
                }}
              >
                You're about to visit an external link. Click continue to proceed.
              </p>

              <button
                onClick={handleContinue}
                style={{
                  width: '100%',
                  padding: '16px',
                  background:
                    'linear-gradient(135deg, #6a5acd 0%, #8a2be2 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '12px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 8px 20px rgba(106, 90, 205, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Continue
              </button>

              <button
                onClick={handleCancel}
                style={{
                  width: '100%',
                  padding: '16px',
                  background: 'transparent',
                  border: '2px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '16px',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <style jsx global>{`
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 0;
          }
        `}</style>
      </div>
    </>
  );
}

import Papa from 'papaparse';

// You will need to replace this with the "Published to Web -> CSV" URL of your Links Google Sheet
const GOOGLE_SHEET_CSV_URL = process.env.NEXT_PUBLIC_LINKS_CSV_URL || 'YOUR_PUBLISHED_CSV_LINK_HERE';

export async function getServerSideProps(context) {
  const { linkId } = context.params;

  // Fallback if the URL hasn't been configured yet
  if (GOOGLE_SHEET_CSV_URL === 'YOUR_PUBLISHED_CSV_LINK_HERE') {
    // Fallback Mock DB so it doesn't instantly crash before you configure it
    const MOCK_LINKS_DB = {
      'ariana1': {
        linkId: 'ariana1',
        creatorName: 'Ariana',
        username: '@arianaangelsxo',
        profileImage: 'https://i.imgur.com/ghzWmXu.jpeg',
        ofCardImage: 'https://i.imgur.com/lUxXtCr.png',
        onlyFansUrl: 'https://onlyfans.com/arianaangelsxo/c90',
        metaPixelId: '693023723805931'
      },
      'rose1': {
        linkId: 'rose1',
        creatorName: 'Rose',
        username: '@rose_vip',
        profileImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600',
        ofCardImage: 'https://images.unsplash.com/photo-1502323707162-2b6e15d8eb8c?auto=format&fit=crop&q=80&w=600',
        onlyFansUrl: 'https://onlyfans.com/example/rose123',
        metaPixelId: '693023723805931'
      }
    };
    const linkData = MOCK_LINKS_DB[linkId];
    if (!linkData) return { notFound: true };
    return { props: { linkData } };
  }

  try {
    // Fetch the live Google Sheet
    const response = await fetch(GOOGLE_SHEET_CSV_URL, { cache: 'no-store' });
    const csvText = await response.text();

    // Parse the CSV
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

    // Find the row that matches this exact linkId
    const row = parsed.data.find(r =>
      (r.LinkId && r.LinkId.trim() === linkId) ||
      (r.linkId && r.linkId.trim() === linkId)
    );

    if (!row) {
      return {
        notFound: true, // Returns 404 page if link isn't in the Google Sheet
      };
    }

    // Map the columns from the Google Sheet (supports fallback capitalization)
    const linkData = {
      linkId: row.LinkId || row.linkId || linkId,
      creatorName: row.CreatorName || row.creatorName || row.Name || 'Creator',
      username: row.Username || row.username || '@creator',
      profileImage: row.ProfileImage || row.profileImage || 'https://i.imgur.com/ghzWmXu.jpeg',
      ofCardImage: row.CardImage || row.ofCardImage || row.cardImage || 'https://i.imgur.com/lUxXtCr.png',
      onlyFansUrl: row.OnlyFansUrl || row.onlyFansUrl || '#',
      metaPixelId: row.MetaPixelId || row.metaPixelId || '693023723805931'
    };

    return {
      props: {
        linkData
      }
    };
  } catch (error) {
    console.error("Failed to parse Google Sheet Links", error);
    return {
      notFound: true
    };
  }
}
