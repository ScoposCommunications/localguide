import { motion } from 'framer-motion';

interface FooterProps {
  profileUrl: string;
}

export function Footer({ profileUrl }: FooterProps) {
  return (
    <footer className="border-t border-slate-200 mt-20 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
            Let's Work Together
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto mb-8">
            Need professional local photography or reviews for your business?
            I help brands connect with travelers through authentic content.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
            >
              View Full Profile
            </a>
            <a
              href="mailto:hello@example.com"
              className="inline-flex items-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-full hover:bg-slate-50 transition-colors"
            >
              Get in Touch
            </a>
          </div>
        </motion.div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
            </div>
            <span className="text-slate-800 font-medium">Local Guide Portfolio</span>
          </div>

          <p className="text-sm text-slate-500">
            Data from{' '}
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 transition-colors"
            >
              Google Maps
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
