import { motion } from 'framer-motion';

interface FooterProps {
  profileUrl: string;
  name?: string;
}

export function Footer({ profileUrl }: FooterProps) {
  return (
    <footer className="relative mt-20 border-t border-[#1f1f1f]">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#34a853]/5 to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 py-16">
        {/* Work with me section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Work With Me
          </h2>
          <p className="text-[#94a3b8] max-w-2xl mx-auto mb-8 text-lg">
            Need authentic local photography or reviews for your business?
            With 8+ years of experience documenting places across the map,
            I can help showcase your location to millions of potential visitors.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-flex items-center gap-2 px-6 py-3 rounded-full
                bg-[#34a853] text-white font-semibold
                hover:bg-[#2d9148] transition-colors duration-200
                shadow-lg shadow-[#34a853]/25
              "
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              View Full Profile
            </a>

            <a
              href={`mailto:contact@example.com?subject=Local Guide Collaboration`}
              className="
                inline-flex items-center gap-2 px-6 py-3 rounded-full
                bg-[#1f1f1f] text-white font-semibold
                hover:bg-[#2a2a2a] border border-[#333]
                transition-colors duration-200
              "
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Get in Touch
            </a>
          </div>
        </motion.div>

        {/* Stats summary */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12"
        >
          {[
            { icon: '📸', label: 'Photos Shared' },
            { icon: '⭐', label: 'Reviews Written' },
            { icon: '🗺️', label: 'Places Visited' },
            { icon: '👁️', label: 'Total Views' },
          ].map((item) => (
            <div
              key={item.label}
              className="text-center p-4 rounded-xl bg-[#111111]/50 border border-[#1f1f1f]"
            >
              <span className="text-2xl mb-2 block">{item.icon}</span>
              <span className="text-sm text-[#94a3b8]">{item.label}</span>
            </div>
          ))}
        </motion.div>

        {/* Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-[#1f1f1f]">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-[#34a853]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span className="text-white font-semibold">Local Guide Portfolio</span>
          </div>

          <p className="text-sm text-[#94a3b8]">
            Data sourced from{' '}
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#34a853] hover:underline"
            >
              Google Maps
            </a>
            {' '}• Built with ❤️
          </p>

          <div className="flex items-center gap-4">
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#94a3b8] hover:text-white transition-colors"
              title="Google Maps Profile"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
