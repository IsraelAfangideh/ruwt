import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../theme';
import SineWaveLoader from '../components/SineWaveLoader';

type Props = {
  navigation?: any;
};

export default function AboutScreen({ navigation }: Props) {
  const colors = useColors();

  const handleGetStarted = () => {
    if (navigation) {
      navigation.navigate('Runners');
    }
  };

  const handlePrivacy = () => {
    Linking.openURL('https://ruwt.social/privacy');
  };

  const handleTerms = () => {
    Linking.openURL('https://ruwt.social/terms');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            A new kind of social network
          </Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Digital Couriers{'\n'}for the Modern Web
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
            Just as ancient couriers carried messages with care and intentionality, 
            <Text style={{ fontWeight: '500', color: colors.text }}> Ruwt </Text> 
            brings mediated communication to the digital world.
          </Text>
          
          {/* Runner Animation */}
          <View style={styles.animationContainer}>
            <SineWaveLoader size="large" />
          </View>

          <TouchableOpacity 
            style={[styles.ctaButton, { backgroundColor: colors.accent }]}
            onPress={handleGetStarted}
          >
            <Text style={[styles.ctaButtonText, { color: colors.bg }]}>
              Get Started
            </Text>
          </TouchableOpacity>
        </View>

        {/* Origin Section */}
        <View style={[styles.section, styles.originSection, { backgroundColor: colors.bgWarm, borderColor: colors.border }]}>
          <Text style={[styles.quote, { color: colors.text }]}>
            "The couriers went throughout all Israel and Judah with letters from the king and his officials..."
          </Text>
          <Text style={[styles.cite, { color: colors.accent }]}>— 2 Chronicles 30:6</Text>
          <Text style={[styles.originText, { color: colors.textMuted }]}>
            The Hebrew word for couriers is <Text style={{ fontStyle: 'italic', color: colors.accent }}>ratzim</Text>, 
            from the root <Text style={{ fontStyle: 'italic', color: colors.accent }}>ruts</Text> (pronounced 
            <Text style={{ fontWeight: '500', color: colors.text }}> ruwts</Text>)—meaning 
            <Text style={{ fontStyle: 'italic', color: colors.accent }}> to run</Text>. 
            These runners didn't just deliver messages; they bridged distances between human hearts.
          </Text>
        </View>

        {/* The Runner Concept */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>The Runner</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Your message, delivered with intention
          </Text>
          
          <Text style={[styles.conceptText, { color: colors.text }]}>
            In Ruwt, you don't DM users directly. You interact with AI 
            <Text style={{ fontWeight: '500', color: colors.accent }}> Runners</Text>—fiduciaries 
            that carry your message with purpose.
          </Text>

          <View style={styles.featureList}>
            <Feature 
              title="Intentional Delivery"
              description="Runners vet and format your communication based on your intent and the recipient's context."
              colors={colors}
            />
            <Feature 
              title="Latency as a Feature"
              description="The slight delay isn't a bug—it's a moment of reflection, reintroducing healthy friction."
              colors={colors}
            />
            <Feature 
              title="Identity Protection"
              description="The sender and receiver don't see each other directly. Only the Runner knows both parties."
              colors={colors}
            />
          </View>
        </View>

        {/* The Peacemaker */}
        <View style={[styles.section, { backgroundColor: colors.bgWarm }]}>
          <View style={[styles.badge, { borderColor: colors.accent }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>First Runner</Text>
          </View>
          <Text style={[styles.peacemakerTitle, { color: colors.text }]}>The Peacemaker</Text>
          <Text style={[styles.peacemakerDesc, { color: colors.textMuted }]}>
            Our first Runner specializes in reconciliation. It intercepts messages that might wound, 
            offering gentler alternatives while preserving your authentic voice.
          </Text>

          {/* Demo Messages */}
          <View style={[styles.demoContainer, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={[styles.demoMessage, styles.demoOriginal, { backgroundColor: colors.errorBg, borderColor: colors.error }]}>
              <Text style={[styles.demoLabel, { color: colors.error }]}>Your draft</Text>
              <Text style={[styles.demoText, { color: colors.textMuted }]}>
                "I can't believe you did that. You never think about anyone but yourself."
              </Text>
            </View>
            
            <Text style={[styles.demoRunner, { color: colors.textSubtle }]}>
              The Peacemaker suggests...
            </Text>
            
            <View style={[styles.demoMessage, styles.demoRevised, { borderColor: colors.accent }]}>
              <Text style={[styles.demoLabel, { color: colors.accent }]}>Suggested revision</Text>
              <Text style={[styles.demoText, { color: colors.text }]}>
                "I was hurt by what happened. I'd like to understand your perspective."
              </Text>
            </View>
            
            <Text style={[styles.demoNote, { color: colors.textSubtle, borderTopColor: colors.border }]}>
              You always have the final say. Send the original, accept the revision, or ask for another option.
            </Text>
          </View>
        </View>

        {/* Philosophy */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Slow Tech in a Fast World
          </Text>
          <Text style={[styles.philosophyIntro, { color: colors.textMuted }]}>
            Modern messaging optimizes for speed. Ruwt optimizes for <Text style={{ fontStyle: 'italic', color: colors.accent }}>intention</Text>.
          </Text>

          <Principle 
            number="01"
            title="AI as Medium, Not Destination"
            description="Most apps frame AI as something you talk to. Ruwt frames AI as something you talk through—to reach other humans."
            colors={colors}
          />
          <Principle 
            number="02"
            title="Privacy by Architecture"
            description="We prioritize data security not as an afterthought, but as a foundation. Your conversations are yours."
            colors={colors}
          />
          <Principle 
            number="03"
            title="Friction Can Be Grace"
            description="The instant 'Blue Bubble' delivery has a cost. A moment of pause before sending can transform conflict into connection."
            colors={colors}
          />
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerLogo, { color: colors.text }]}>ruwt</Text>
          <Text style={[styles.footerTagline, { color: colors.textSubtle }]}>
            Digital Couriers for the Modern Web
          </Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={handlePrivacy}>
              <Text style={[styles.footerLink, { color: colors.textMuted }]}>Privacy</Text>
            </TouchableOpacity>
            <Text style={[styles.footerDivider, { color: colors.textSubtle }]}>·</Text>
            <TouchableOpacity onPress={handleTerms}>
              <Text style={[styles.footerLink, { color: colors.textMuted }]}>Terms</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.copyright, { color: colors.textSubtle }]}>
            © 2025 Ruwt. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Feature component
function Feature({ title, description, colors }: { title: string; description: string; colors: any }) {
  return (
    <View style={styles.feature}>
      <Text style={[styles.featureTitle, { color: colors.accent }]}>{title}</Text>
      <Text style={[styles.featureDesc, { color: colors.textMuted }]}>{description}</Text>
    </View>
  );
}

// Principle component
function Principle({ number, title, description, colors }: { number: string; title: string; description: string; colors: any }) {
  return (
    <View style={[styles.principle, { borderLeftColor: colors.border }]}>
      <Text style={[styles.principleNumber, { color: colors.accent }]}>{number}</Text>
      <Text style={[styles.principleTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.principleDesc, { color: colors.textMuted }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  
  // Hero
  hero: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: '300',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    lineHeight: 48,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  heroSubtitle: {
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 32,
  },
  animationContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  ctaButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Origin
  originSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  quote: {
    fontSize: 22,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
    lineHeight: 32,
    textAlign: 'center',
    marginBottom: 8,
  },
  cite: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  originText: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
  },

  // Sections
  section: {
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },

  // Concept
  conceptText: {
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 32,
  },
  featureList: {
    gap: 24,
  },
  feature: {
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 15,
    lineHeight: 22,
  },

  // Peacemaker
  badge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 20,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  peacemakerTitle: {
    fontSize: 36,
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
    marginBottom: 16,
  },
  peacemakerDesc: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 32,
  },

  // Demo
  demoContainer: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  demoMessage: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  demoOriginal: {},
  demoRevised: {},
  demoLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  demoText: {
    fontSize: 15,
    lineHeight: 22,
  },
  demoRunner: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
  },
  demoNote: {
    fontSize: 13,
    textAlign: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
  },

  // Philosophy
  philosophyIntro: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 32,
  },
  principle: {
    paddingLeft: 20,
    borderLeftWidth: 1,
    marginBottom: 24,
  },
  principleNumber: {
    fontSize: 28,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 8,
  },
  principleTitle: {
    fontSize: 17,
    fontWeight: '500',
    marginBottom: 8,
  },
  principleDesc: {
    fontSize: 15,
    lineHeight: 22,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerLogo: {
    fontSize: 24,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    marginBottom: 4,
  },
  footerTagline: {
    fontSize: 13,
    marginBottom: 16,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  footerLink: {
    fontSize: 14,
  },
  footerDivider: {
    marginHorizontal: 8,
  },
  copyright: {
    fontSize: 12,
  },
});

