"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { useLoginContext } from "@/lib/login-context"
import { useFlag } from "@/lib/launchdarkly/client"
import { useTrackMetric } from "@/lib/launchdarkly/metrics"
import { motion } from "framer-motion"
import { Gift, Star, Sparkles, TrendingUp, Zap, Crown, Users, Share2, Copy, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface RewardsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface RewardOffer {
  id: string
  title: string
  description: string
  discount?: string
  points?: number
  icon: "gift" | "star" | "zap" | "trending"
  tier?: string[]
}

// Mock offers based on tier
const getOffersForTier = (tier: string): RewardOffer[] => {
  const allOffers: RewardOffer[] = [
    {
      id: "1",
      title: "Free Shipping",
      description: tier === "Platinum" ? "On all orders" : "On orders over $50",
      discount: "Free",
      icon: "gift",
    },
    {
      id: "2",
      title: "Double Points",
      description: "Earn 2x points this week",
      points: 200,
      icon: "star",
    },
    {
      id: "3",
      title: "Flash Sale Access",
      description: "Early access to flash sales",
      icon: "zap",
      tier: ["Gold", "Platinum"],
    },
    {
      id: "4",
      title: "Birthday Bonus",
      description: "500 bonus points on your birthday",
      points: 500,
      icon: "gift",
    },
    {
      id: "5",
      title: "VIP Support",
      description: "Priority customer support",
      icon: "trending",
      tier: ["Platinum"],
    },
  ]

  return allOffers.filter(
    (offer) => !offer.tier || offer.tier.includes(tier)
  )
}

// Calculate points based on tier (for demo)
const getPointsForTier = (tier: string): number => {
  const pointsMap: Record<string, number> = {
    Standard: 1250,
    Silver: 2850,
    Gold: 5420,
    Platinum: 8750,
  }
  return pointsMap[tier] || 0
}

const getTierColor = (tier: string): string => {
  const colorMap: Record<string, string> = {
    Standard: "#A7A9AC",
    Silver: "#C0C0C0",
    Gold: "#FFD700",
    Platinum: "#7084FF",
  }
  return colorMap[tier] || "#A7A9AC"
}

const getTierIcon = (tier: string) => {
  if (tier === "Platinum" || tier === "Gold") {
    return <Crown size={16} className="text-[#FFD700]" />
  }
  return <Star size={16} className="text-[#7084FF]" />
}

// Generate referral code from email (for demo purposes)
const generateReferralCode = (email: string): string => {
  // Simple hash-based code generation for demo
  const hash = email.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0) | 0
  }, 0)
  return `REF${Math.abs(hash).toString(36).toUpperCase().slice(0, 8)}`
}

const OfferCard = ({ offer }: { offer: RewardOffer }) => {
  const iconMap = {
    gift: <Gift size={20} className="text-[#7084FF]" />,
    star: <Star size={20} className="text-[#FFD700]" />,
    zap: <Zap size={20} className="text-[#7084FF]" />,
    trending: <TrendingUp size={20} className="text-[#7084FF]" />,
  }

  return (
    <div
      className="p-4 md:p-5 rounded-[15px] border border-[#2c2c2c] hover:border-[#7084FF] transition-all cursor-pointer bg-[rgba(33,33,33,0.3)]"
      style={{
        backgroundImage: "linear-gradient(179deg, rgba(0, 0, 0, 0.2) 0%, rgba(0, 0, 0, 0.4) 100%)",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-[#7084FF]/10 flex items-center justify-center border border-[#7084FF]/30">
          {iconMap[offer.icon]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white text-base md:text-lg font-bold truncate">
              {offer.title}
            </h3>
            {offer.discount && (
              <Badge
                variant="outline"
                className="border-[#7084FF] text-[#7084FF] text-xs"
              >
                {offer.discount}
              </Badge>
            )}
            {offer.points && (
              <Badge
                variant="outline"
                className="border-[#FFD700] text-[#FFD700] text-xs"
              >
                +{offer.points} pts
              </Badge>
            )}
          </div>
          <p className="text-[#A7A9AC] text-xs md:text-sm leading-normal">
            {offer.description}
          </p>
        </div>
      </div>
    </div>
  )
}

export function RewardsDialog({ open, onOpenChange }: RewardsDialogProps) {
  const { isLoggedIn, userObject } = useLoginContext()
  const rewardsProgramEnabled = useFlag("rewardsProgram", false)
  const referralProgramEnabled = useFlag("referralProgram", false)
  const trackMetric = useTrackMetric()
  const points = isLoggedIn ? getPointsForTier(userObject.personatier) : 0
  const offers = isLoggedIn ? getOffersForTier(userObject.personatier) : []
  const tierColor = isLoggedIn ? getTierColor(userObject.personatier) : "#A7A9AC"
  const referralCode = isLoggedIn && userObject.personaemail 
    ? generateReferralCode(userObject.personaemail) 
    : ""
  const [copied, setCopied] = useState(false)
  
  // Mock referral stats (for demo) - using email as seed for consistent values
  const getReferralStats = () => {
    if (!isLoggedIn || !userObject.personaemail) {
      return { totalReferrals: 0, pointsEarned: 0 }
    }
    // Use email hash for consistent demo stats
    const seed = userObject.personaemail.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return {
      totalReferrals: (seed % 15) + 1,
      pointsEarned: ((seed % 50) + 5) * 100,
    }
  }
  const referralStats = getReferralStats()

  const handleCopyCode = async () => {
    if (referralCode) {
      try {
        await navigator.clipboard.writeText(referralCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error("Failed to copy:", err)
      }
    }
  }

  // Track rewards accessed when dialog opens
  useEffect(() => {
    if (open && rewardsProgramEnabled) {
      trackMetric("rewards-accessed")
    }
  }, [open, trackMetric, rewardsProgramEnabled])

  // Don't render if feature flag is disabled
  if (!rewardsProgramEnabled) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-full sm:max-w-[98vw] md:max-w-[95vw] lg:max-w-[96vw] xl:max-w-[1400px] w-full sm:w-auto h-screen sm:h-auto border-0 sm:border border-[#58595b] rounded-0 sm:rounded-[30px] p-0 bg-[#191919] max-h-screen sm:max-h-[90vh] overflow-y-hidden overflow-x-hidden top-0! left-0! translate-x-0! translate-y-0! sm:top-[50%]! sm:left-[50%]! sm:-translate-x-1/2! sm:-translate-y-1/2! flex flex-col"
        style={{
          backgroundImage:
            "linear-gradient(179.99999992093447deg, rgba(0, 0, 0, 0) 23.03%, rgba(0, 0, 0, 1) 129.6%), linear-gradient(90deg, rgba(25, 25, 25, 1) 0%, rgba(25, 25, 25, 1) 100%)",
        }}
        showCloseButton={false}
      >
        <VisuallyHidden>
          <DialogTitle>
            {isLoggedIn ? "Rewards Program" : "Join Rewards Program"}
          </DialogTitle>
        </VisuallyHidden>

        {/* Header */}
        <div className="flex items-center gap-6 px-4 sm:px-6 md:px-8 pt-6 sm:pt-10 pb-5 shrink-0">
          <div className="w-12 h-12 rounded-full bg-[#7084FF]/10 flex items-center justify-center border border-[#7084FF]">
            <Sparkles size={24} className="text-[#7084FF]" />
          </div>
          <h2 className="text-white text-[28px] sm:text-[32px] font-bold leading-[1.3] flex-1">
            {isLoggedIn ? "Rewards Program" : "Join Rewards Program"}
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="w-[54px] h-[54px] rounded-full border-[1.125px] border-[#7084FF] flex items-center justify-center hover:bg-[#7084FF]/10 transition-colors shrink-0"
          >
            <Image
              src="/assets/icons/close.svg"
              alt="Close"
              width={31.5}
              height={31.5}
              className="w-[31.5px] h-[31.5px]"
            />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 md:px-8 pb-8 sm:pb-10 overflow-y-hidden overflow-x-hidden flex-1 min-h-0">
          <div
            className="overflow-y-auto overflow-x-hidden max-h-[calc(90vh-200px)] sm:max-h-[calc(90vh-250px)] hide-scrollbar"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            {isLoggedIn ? (
              /* Logged In View */
              <div className="space-y-6 md:space-y-8">
                {/* User Info Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="p-5 md:p-6 rounded-[20px] border border-[#7084FF] bg-[rgba(112, 132, 255, 0.05)]"
                  style={{
                    backgroundImage:
                      "linear-gradient(179deg, rgba(112, 132, 255, 0.1) 0%, rgba(0, 0, 0, 0.3) 100%)",
                  }}
                >
                  <div className="flex items-center gap-4 md:gap-5">
                    {userObject.personaimage && (
                      <div className="relative shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border-2 border-[#7084FF]">
                        <Image
                          src={userObject.personaimage}
                          alt={userObject.personaname}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-white text-xl md:text-2xl font-bold truncate">
                          {userObject.personaname}
                        </h3>
                        {getTierIcon(userObject.personatier)}
                      </div>
                      <p className="text-[#A7A9AC] text-sm md:text-base mb-2 truncate">
                        {userObject.personaemail}
                      </p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge
                          variant="outline"
                          className="border-[#7084FF] text-[#7084FF] text-xs md:text-sm px-3 py-1"
                          style={{ borderColor: tierColor, color: tierColor }}
                        >
                          {userObject.personatier} Member
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-[#FFD700] text-[#FFD700] text-xs md:text-sm px-3 py-1"
                        >
                          {userObject.personarole}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Points Display */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="p-6 md:p-8 rounded-[20px] border border-[#58595b] bg-[rgba(33,33,33,0.3)] text-center"
                >
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Star size={24} className="text-[#FFD700]" fill="#FFD700" />
                    <p className="text-[#A7A9AC] text-sm md:text-base">
                      Your Points
                    </p>
                  </div>
                  <motion.p
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                    className="text-[#7084FF] text-4xl md:text-5xl lg:text-6xl font-bold font-mono"
                  >
                    {points.toLocaleString()}
                  </motion.p>
                  <p className="text-[#58595B] text-xs md:text-sm mt-2">
                    Redeem points for exclusive rewards
                  </p>
                </motion.div>

                {/* Referral Program Section */}
                {referralProgramEnabled && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.25 }}
                    className="p-5 md:p-6 rounded-[20px] border-2 border-[#7084FF] bg-[rgba(112, 132, 255, 0.05)]"
                    style={{
                      backgroundImage:
                        "linear-gradient(179deg, rgba(112, 132, 255, 0.15) 0%, rgba(0, 0, 0, 0.3) 100%)",
                    }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-[#7084FF]/20 flex items-center justify-center border border-[#7084FF]">
                        <Users size={20} className="text-[#7084FF]" />
                      </div>
                      <h3 className="text-white text-xl md:text-2xl font-bold">
                        Referral Program
                      </h3>
                    </div>

                    <div className="space-y-4 md:space-y-5">
                      {/* Referral Code */}
                      <div className="space-y-2">
                        <p className="text-[#A7A9AC] text-sm md:text-base">
                          Share your code and earn rewards
                        </p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 p-4 rounded-[15px] bg-[rgba(0, 0, 0, 0.3)] border border-[#58595b]">
                            <p className="text-white text-lg md:text-xl font-mono font-bold">
                              {referralCode}
                            </p>
                          </div>
                          <button
                            onClick={handleCopyCode}
                            className="px-4 md:px-6 py-4 rounded-[15px] bg-[#7084FF] hover:bg-[#5a6fe6] transition-colors flex items-center gap-2 text-white font-semibold"
                          >
                            {copied ? (
                              <>
                                <Check size={18} />
                                <span className="hidden sm:inline">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy size={18} />
                                <span className="hidden sm:inline">Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Benefits */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-[15px] bg-[rgba(0, 0, 0, 0.2)] border border-[#58595b]">
                          <div className="flex items-center gap-2 mb-2">
                            <Share2 size={18} className="text-[#7084FF]" />
                            <h4 className="text-white font-bold text-base md:text-lg">
                              You Get
                            </h4>
                          </div>
                          <p className="text-[#A7A9AC] text-sm md:text-base">
                            <span className="text-[#FFD700] font-bold">500 points</span> for each successful referral
                          </p>
                        </div>
                        <div className="p-4 rounded-[15px] bg-[rgba(0, 0, 0, 0.2)] border border-[#58595b]">
                          <div className="flex items-center gap-2 mb-2">
                            <Gift size={18} className="text-[#7084FF]" />
                            <h4 className="text-white font-bold text-base md:text-lg">
                              They Get
                            </h4>
                          </div>
                          <p className="text-[#A7A9AC] text-sm md:text-base">
                            <span className="text-[#FFD700] font-bold">250 points</span> when they sign up with your code
                          </p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="pt-4 border-t border-[#58595b]">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[#A7A9AC] text-xs md:text-sm mb-1">
                              Total Referrals
                            </p>
                            <p className="text-white text-2xl md:text-3xl font-bold">
                              {referralStats.totalReferrals}
                            </p>
                          </div>
                          <div>
                            <p className="text-[#A7A9AC] text-xs md:text-sm mb-1">
                              Points Earned
                            </p>
                            <p className="text-[#FFD700] text-2xl md:text-3xl font-bold font-mono">
                              {referralStats.pointsEarned.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Offers Section */}
                {offers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: referralProgramEnabled ? 0.3 : 0.2 }}
                    className="space-y-4"
                  >
                    <h3 className="text-white text-xl md:text-2xl font-bold">
                      Your Exclusive Offers
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {offers.map((offer, index) => (
                        <motion.div
                          key={offer.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: (referralProgramEnabled ? 0.4 : 0.3) + index * 0.1,
                          }}
                        >
                          <OfferCard offer={offer} />
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            ) : (
              /* Anonymous User - Join Promo */
              <div className="space-y-6 md:space-y-8">
                {/* Hero Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-center space-y-4 md:space-y-6 py-4 md:py-8"
                >
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-full bg-[#7084FF]/10 border-2 border-[#7084FF] mb-4"
                  >
                    <Sparkles size={40} className="text-[#7084FF]" />
                  </motion.div>
                  <h3 className="text-white text-2xl md:text-3xl lg:text-4xl font-bold">
                    Join ToggleStore Rewards
                  </h3>
                  <p className="text-[#A7A9AC] text-base md:text-lg max-w-2xl mx-auto">
                    Earn points on every purchase, unlock exclusive offers, and
                    enjoy member-only benefits
                  </p>
                </motion.div>

                {/* Referral Program Promo (for anonymous users) */}
                {referralProgramEnabled && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.25 }}
                    className="p-5 md:p-6 rounded-[20px] border-2 border-[#7084FF] bg-[rgba(112, 132, 255, 0.1)]"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-[#7084FF]/20 flex items-center justify-center border border-[#7084FF]">
                        <Users size={24} className="text-[#7084FF]" />
                      </div>
                      <h3 className="text-white text-xl md:text-2xl font-bold">
                        Referral Program
                      </h3>
                    </div>
                    <p className="text-[#A7A9AC] text-sm md:text-base mb-4">
                      Refer friends and earn rewards! Both you and your friend get bonus points when they sign up.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-[15px] bg-[rgba(0, 0, 0, 0.2)] border border-[#58595b]">
                        <div className="flex items-center gap-2 mb-2">
                          <Share2 size={18} className="text-[#7084FF]" />
                          <h4 className="text-white font-bold">You Get</h4>
                        </div>
                        <p className="text-[#A7A9AC] text-sm">
                          <span className="text-[#FFD700] font-bold">500 points</span> per referral
                        </p>
                      </div>
                      <div className="p-4 rounded-[15px] bg-[rgba(0, 0, 0, 0.2)] border border-[#58595b]">
                        <div className="flex items-center gap-2 mb-2">
                          <Gift size={18} className="text-[#7084FF]" />
                          <h4 className="text-white font-bold">They Get</h4>
                        </div>
                        <p className="text-[#A7A9AC] text-sm">
                          <span className="text-[#FFD700] font-bold">250 points</span> when they join
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Benefits Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {[
                    {
                      icon: <Star size={24} className="text-[#FFD700]" />,
                      title: "Earn Points",
                      description:
                        "Get 1 point for every $1 spent. Points never expire!",
                    },
                    {
                      icon: <Gift size={24} className="text-[#7084FF]" />,
                      title: "Exclusive Offers",
                      description:
                        "Access special discounts and early sale notifications",
                    },
                    {
                      icon: <Crown size={24} className="text-[#FFD700]" />,
                      title: "Tier Benefits",
                      description:
                        "Unlock higher tiers for better rewards and perks",
                    },
                    {
                      icon: <Zap size={24} className="text-[#7084FF]" />,
                      title: "Fast Checkout",
                      description:
                        "Save your preferences for quicker shopping",
                    },
                    {
                      icon: <TrendingUp size={24} className="text-[#7084FF]" />,
                      title: "Birthday Rewards",
                      description: "Special bonus points on your birthday",
                    },
                    {
                      icon: <Sparkles size={24} className="text-[#7084FF]" />,
                      title: "VIP Support",
                      description:
                        "Priority customer service for premium members",
                    },
                  ].map((benefit, index) => (
                    <motion.div
                      key={benefit.title}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        delay: 0.3 + index * 0.1,
                      }}
                      className="p-5 md:p-6 rounded-[15px] border border-[#2c2c2c] hover:border-[#7084FF] transition-all bg-[rgba(33,33,33,0.3)]"
                    >
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 w-12 h-12 rounded-full bg-[#7084FF]/10 flex items-center justify-center border border-[#7084FF]/30">
                          {benefit.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white text-lg font-bold mb-2">
                            {benefit.title}
                          </h4>
                          <p className="text-[#A7A9AC] text-sm leading-normal">
                            {benefit.description}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* CTA Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.8 }}
                  className="p-6 md:p-8 rounded-[20px] border-2 border-[#7084FF] bg-[rgba(112, 132, 255, 0.1)] text-center"
                >
                  <h4 className="text-white text-xl md:text-2xl font-bold mb-3">
                    Start Earning Today!
                  </h4>
                  <p className="text-[#A7A9AC] text-sm md:text-base mb-6">
                    Sign in with your account to automatically enroll in the
                    rewards program
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onOpenChange(false)}
                    className="px-8 py-3 md:px-10 md:py-4 rounded-[60px] bg-[#7084FF] text-white font-bold text-base md:text-lg hover:bg-[#5a6fe6] transition-colors"
                  >
                    Get Started
                  </motion.button>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

