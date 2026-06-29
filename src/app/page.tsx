'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, MapPin, Zap, Users, TrendingUp, BarChart3, MessageSquare } from 'lucide-react';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-700 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Community Hero AI
          </div>
          <div className="flex gap-4">
            <Link href="/auth/login">
              <Button variant="outline" className="border-slate-600 hover:bg-slate-800">
                Login
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="bg-blue-600 hover:bg-blue-700">Sign Up</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          <motion.h1
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6"
            variants={fadeInUp}
          >
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Civic Issues Solved
            </span>
            <br />
            <span className="text-white">by AI & Community</span>
          </motion.h1>

          <motion.p
            className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto"
            variants={fadeInUp}
          >
            Report problems, verify issues, and resolve them faster. Community Hero AI automates civic
            issue management with AI-powered analysis and intelligent routing.
          </motion.p>

          <motion.div className="flex gap-4 justify-center mb-16" variants={fadeInUp}>
            <Link href="/report">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Report Issue <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="border-slate-600 hover:bg-slate-800">
                View Dashboard
              </Button>
            </Link>
          </motion.div>

          <motion.div
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg p-8 border border-slate-700"
            variants={fadeInUp}
          >
            <div className="text-sm text-slate-400">Trusted by civic leaders across communities</div>
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-slate-300">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span> Real-time tracking
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span> AI-powered analysis
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full"></span> Community collaboration
              </span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              A complete workflow from reporting to resolution, powered by intelligent AI agents
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                num: '1',
                title: 'Report',
                desc: 'Submit civic issues with photos and location data',
                icon: MapPin,
              },
              {
                num: '2',
                title: 'Analyze',
                desc: 'AI agents classify and verify the issue automatically',
                icon: Zap,
              },
              {
                num: '3',
                title: 'Verify',
                desc: 'Community and AI verification confirms the problem',
                icon: Users,
              },
              {
                num: '4',
                title: 'Resolve',
                desc: 'Department executes resolution with tracking and reminders',
                icon: TrendingUp,
              },
            ].map((step, i) => (
              <motion.div
                key={i}
                className="bg-slate-800 rounded-lg p-6 border border-slate-700"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="text-3xl font-bold text-blue-400 mb-2">{step.num}</div>
                <div className="flex items-center gap-3 mb-3">
                  <step.icon className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                </div>
                <p className="text-slate-400 text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-4">Powerful Features</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Advanced capabilities for citizens, verifiers, officers, and administrators
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'AI Issue Analysis',
                desc: 'Automatic categorization and severity assessment using machine learning',
                icon: Zap,
              },
              {
                title: 'Community Verification',
                desc: 'Crowdsourced verification for increased confidence and accountability',
                icon: Users,
              },
              {
                title: 'Smart Routing',
                desc: 'Intelligent department assignment based on issue type and severity',
                icon: TrendingUp,
              },
              {
                title: 'Real-Time Analytics',
                desc: 'Live dashboards tracking issues, resolutions, and department performance',
                icon: BarChart3,
              },
              {
                title: 'Escalation Management',
                desc: 'Automatic escalation for high-priority or overdue issues',
                icon: ArrowRight,
              },
              {
                title: 'Community Heatmaps',
                desc: 'Geographic visualization of issue hotspots and trends',
                icon: MapPin,
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-blue-500 transition-colors"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <feature.icon className="w-8 h-8 text-blue-400 mb-3" />
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact Metrics */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { metric: '5,234', label: 'Issues Tracked', icon: MapPin },
              { metric: '87%', label: 'Resolution Rate', icon: TrendingUp },
              { metric: '3.2 days', label: 'Avg Resolution Time', icon: BarChart3 },
              { metric: '12,458', label: 'Community Votes', icon: Users },
            ].map((item, i) => (
              <motion.div
                key={i}
                className="text-center"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="flex justify-center mb-3">
                  <item.icon className="w-8 h-8 text-blue-400" />
                </div>
                <div className="text-4xl font-bold text-white mb-1">{item.metric}</div>
                <div className="text-slate-400">{item.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-4xl mx-auto bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg p-12 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl font-bold text-white mb-4">Make a Difference Today</h2>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            Join the community revolution. Report issues, help verify them, and watch them get resolved
            faster.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/report">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50">
                Report Your First Issue
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Join Community
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="text-lg font-bold text-blue-400 mb-4">Community Hero AI</div>
              <p className="text-slate-400 text-sm">
                Empowering communities through AI-powered civic issue management
              </p>
            </div>
            {[
              {
                title: 'Product',
                links: ['Features', 'Dashboard', 'API', 'Pricing'],
              },
              {
                title: 'Community',
                links: ['Guidelines', 'Issues', 'Feedback', 'Stories'],
              },
              {
                title: 'Support',
                links: ['Documentation', 'Contact', 'FAQ', 'Status'],
              },
            ].map((col, i) => (
              <div key={i}>
                <h4 className="text-white font-semibold mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <a href="#" className="text-slate-400 hover:text-slate-200 transition-colors text-sm">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-700 pt-8 flex items-center justify-between">
            <p className="text-slate-400 text-sm">
              &copy; {new Date().getFullYear()} Community Hero AI. All rights reserved.
            </p>
            <div className="flex gap-4">
              <a href="#" className="text-slate-400 hover:text-slate-200 transition-colors">
                Twitter
              </a>
              <a href="#" className="text-slate-400 hover:text-slate-200 transition-colors">
                GitHub
              </a>
              <a href="#" className="text-slate-400 hover:text-slate-200 transition-colors">
                Discord
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
