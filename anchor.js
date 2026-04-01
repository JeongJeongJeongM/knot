/**
 * ANCHOR v1.0.0 — JavaScript Port
 * Single-file client-side implementation of the ANCHOR relationship analysis engine.
 *
 * Original Python source ported to JavaScript with all Korean keyword patterns preserved.
 * Legal safety: Behavioral descriptions only, no diagnostic labels, no scoring.
 */

(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // ENGINE META
  // ═══════════════════════════════════════════════════════════════

  const ENGINE_NAME = "ANCHOR";
  const ENGINE_VERSION = "1.0.0";
  const SPEC_VERSION = "1.0";

  // ═══════════════════════════════════════════════════════════════
  // R1. ATTACHMENT SIGNAL CONFIG
  // ═══════════════════════════════════════════════════════════════

  const ATTACHMENT_TENDENCIES = [
    "leans_secure",
    "leans_anxious",
    "leans_avoidant",
    "leans_disorganized",
  ];

  const STRESS_SHIFT_PATTERNS = [
    "stable_under_pressure",
    "mild_anxious_under_pressure",
    "withdrawal_under_pressure",
    "escalation_under_pressure",
    "inconsistent_under_pressure",
  ];

  const REASSURANCE_SEEKING_HIGH = 0.15;
  const EMOTIONAL_AVOIDANCE_HIGH = 0.20;

  // ═══════════════════════════════════════════════════════════════
  // R2. CONFLICT NAVIGATION CONFIG
  // ═══════════════════════════════════════════════════════════════

  const CONFLICT_MODES = [
    "direct_engagement",
    "diplomatic_approach",
    "strategic_withdrawal",
    "avoidance",
    "escalation",
  ];

  const RECOVERY_SPEED_LABELS = ["fast", "moderate", "slow"];
  const PATTERN_FLEXIBILITY_LABELS = ["rigid", "medium", "flexible"];

  // ═══════════════════════════════════════════════════════════════
  // R3. EMOTIONAL AVAILABILITY CONFIG
  // ═══════════════════════════════════════════════════════════════

  const RECOGNITION_SPEED_LABELS = ["slow", "moderate", "quick"];
  const RESPONSE_STYLES = [
    "dismissive",
    "acknowledging",
    "supportive",
    "empathic_exploration",
  ];
  const SOLUTION_VS_SPACE_LABELS = [
    "solution_focused",
    "balanced",
    "space_holding",
  ];
  const SELF_DISCLOSURE_LABELS = ["minimal", "moderate", "open"];

  // ═══════════════════════════════════════════════════════════════
  // R4. GROWTH ORIENTATION CONFIG
  // ═══════════════════════════════════════════════════════════════

  const GROWTH_ORIENTATIONS = [
    "active_growth",
    "reflective_growth",
    "stability_oriented",
    "externally_driven",
  ];

  const CHANGE_TOLERANCE_LABELS = ["low", "moderate", "high"];
  const IMPROVEMENT_FREQUENCY_LABELS = ["rare", "periodic", "frequent"];

  // ═══════════════════════════════════════════════════════════════
  // MATCHING WEIGHTS & COMPATIBILITY MATRIX
  // ═══════════════════════════════════════════════════════════════

  const MATCH_WEIGHT_ATTACHMENT = 0.30;
  const MATCH_WEIGHT_CONFLICT = 0.25;
  const MATCH_WEIGHT_EMOTIONAL = 0.25;
  const MATCH_WEIGHT_GROWTH = 0.20;

  // Attachment compatibility matrix (1.0 = optimal, 0.0 = worst)
  // ⚠️ This is relationship health risk estimation, not a score
  const ATTACHMENT_COMPATIBILITY = {
    "leans_secure,leans_secure": 0.90,
    "leans_secure,leans_anxious": 0.65,
    "leans_secure,leans_avoidant": 0.60,
    "leans_secure,leans_disorganized": 0.40,
    "leans_anxious,leans_secure": 0.65,
    "leans_anxious,leans_anxious": 0.50,
    "leans_anxious,leans_avoidant": 0.20,   // typical toxic combination
    "leans_anxious,leans_disorganized": 0.15,
    "leans_avoidant,leans_secure": 0.60,
    "leans_avoidant,leans_anxious": 0.20,   // typical toxic combination
    "leans_avoidant,leans_avoidant": 0.35,
    "leans_avoidant,leans_disorganized": 0.15,
    "leans_disorganized,leans_secure": 0.40,
    "leans_disorganized,leans_anxious": 0.15,
    "leans_disorganized,leans_avoidant": 0.15,
    "leans_disorganized,leans_disorganized": 0.10,
  };

  // ═══════════════════════════════════════════════════════════════
  // PIPELINE CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════

  const MIN_TURNS_FOR_ANALYSIS = 10;
  const MAX_TURNS_PER_SESSION = 1000;
  const EPSILON = 1e-12;
  const JSON_ROUND_DIGITS = 4;

  // ═══════════════════════════════════════════════════════════════
  // R1. ATTACHMENT ANALYZER
  // ═══════════════════════════════════════════════════════════════

  const SECURE_SIGNALS = [
    "괜찮아", "이해해", "고마워", "알겠어", "맞아",
    "당연하지", "그럴 수 있지", "충분해", "함께",
  ];

  const ANXIOUS_SIGNALS = [
    "왜 답 안 해", "언제 연락", "나 싫어", "혼자",
    "확인", "진짜", "불안", "걱정", "왜 안 돼",
    "나한테 관심", "무시하는 거", "다른 사람",
    "어디야", "뭐하는 거야", "화났어",
  ];

  const AVOIDANT_SIGNALS = [
    "그냥", "몰라", "알아서 해", "바빠", "나중에",
    "상관없어", "별로", "귀찮", "그런 얘기 왜",
    "감정적이지 마", "오버하지 마",
  ];

  const DISORGANIZED_SIGNALS = [
    "사랑해 근데 짜증나", "보고 싶은데 만나기 싫",
    "좋은데 불안해", "가까이 오지마 근데 가지마",
  ];

  const STRESS_INDICATORS = [
    "짜증", "화", "스트레스", "힘들", "지쳤",
    "싸움", "갈등", "문제", "왜 그래", "미치겠",
  ];

  function R1AttachmentAnalyzer_analyze(texts) {
    if (!texts || texts.length === 0) {
      return {
        primary_tendency: "leans_secure",
        stress_shift: "stable_under_pressure",
        narrative: "",
        reassurance_seeking_ratio: 0.0,
        emotional_avoidance_ratio: 0.0,
      };
    }

    const total = texts.length;
    let secure_count = 0;
    let anxious_count = 0;
    let avoidant_count = 0;
    let disorganized_count = 0;
    let reassurance_count = 0;
    let avoidance_count = 0;
    const stress_texts = [];
    const normal_texts = [];

    for (const text of texts) {
      const text_lower = text.toLowerCase();
      const is_stress = STRESS_INDICATORS.some(s => text_lower.includes(s));

      if (is_stress) {
        stress_texts.push(text);
      } else {
        normal_texts.push(text);
      }

      // Signal detection
      if (SECURE_SIGNALS.some(s => text_lower.includes(s))) {
        secure_count++;
      }
      if (ANXIOUS_SIGNALS.some(s => text_lower.includes(s))) {
        anxious_count++;
        reassurance_count++;
      }
      if (AVOIDANT_SIGNALS.some(s => text_lower.includes(s))) {
        avoidant_count++;
        avoidance_count++;
      }
      if (DISORGANIZED_SIGNALS.some(s => text_lower.includes(s))) {
        disorganized_count++;
      }
    }

    const counts = {
      "leans_secure": secure_count,
      "leans_anxious": anxious_count,
      "leans_avoidant": avoidant_count,
      "leans_disorganized": disorganized_count,
    };

    let primary = Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
    if (Object.values(counts).every(v => v === 0)) {
      primary = "leans_secure";
    }

    const stress_shift = R1AttachmentAnalyzer_analyzeStressShift(
      normal_texts, stress_texts, primary
    );

    const reassurance_ratio = Math.round(
      (reassurance_count / (total + EPSILON)) * 10000
    ) / 10000;
    const avoidance_ratio = Math.round(
      (avoidance_count / (total + EPSILON)) * 10000
    ) / 10000;

    const narrative = R1AttachmentAnalyzer_generateNarrative(
      primary, stress_shift, reassurance_ratio, avoidance_ratio
    );

    return {
      primary_tendency: primary,
      stress_shift: stress_shift,
      narrative: narrative,
      reassurance_seeking_ratio: reassurance_ratio,
      emotional_avoidance_ratio: avoidance_ratio,
    };
  }

  function R1AttachmentAnalyzer_analyzeStressShift(normal_texts, stress_texts, normal_tendency) {
    if (stress_texts.length === 0) {
      return "stable_under_pressure";
    }

    let stress_anxious = 0;
    let stress_avoidant = 0;

    for (const text of stress_texts) {
      const text_lower = text.toLowerCase();
      if (ANXIOUS_SIGNALS.some(s => text_lower.includes(s))) {
        stress_anxious++;
      }
      if (AVOIDANT_SIGNALS.some(s => text_lower.includes(s))) {
        stress_avoidant++;
      }
    }

    const total_stress = stress_texts.length + EPSILON;

    if (stress_anxious / total_stress > 0.4) {
      return "mild_anxious_under_pressure";
    } else if (stress_avoidant / total_stress > 0.4) {
      return "withdrawal_under_pressure";
    } else if (stress_anxious > 0 && stress_avoidant > 0) {
      return "inconsistent_under_pressure";
    } else if (normal_tendency === "leans_secure") {
      return "stable_under_pressure";
    } else {
      return "escalation_under_pressure";
    }
  }

  function R1AttachmentAnalyzer_generateNarrative(tendency, stress_shift, reassurance_ratio, avoidance_ratio) {
    const narratives = {
      "leans_secure": "평상시 안정적이고 일관된 대화 패턴을 보입니다.",
      "leans_anxious": "감정적 확인과 연결 유지에 대한 관심이 높은 대화 패턴을 보입니다.",
      "leans_avoidant": "감정적 거리를 유지하며 독립적인 대화 패턴을 보입니다.",
      "leans_disorganized": "감정 표현에 있어 상반된 경향이 공존하는 패턴을 보입니다.",
    };

    const stress_narratives = {
      "stable_under_pressure": "",
      "mild_anxious_under_pressure": " 감정적 압박 상황에서 확인 요구가 증가하는 경향이 있습니다.",
      "withdrawal_under_pressure": " 감정적 압박 상황에서 거리두기 경향이 나타납니다.",
      "escalation_under_pressure": " 감정적 압박 상황에서 감정 표현이 강해지는 경향이 있습니다.",
      "inconsistent_under_pressure": " 감정적 압박 상황에서 반응 패턴이 일관적이지 않습니다.",
    };

    const base = narratives[tendency] || "";
    const stress_note = stress_narratives[stress_shift] || "";
    return base + stress_note;
  }

  // ═══════════════════════════════════════════════════════════════
  // R2. CONFLICT ANALYZER
  // ═══════════════════════════════════════════════════════════════

  const CONFLICT_SIGNALS = {
    "direct_engagement": [
      "솔직히 말하면", "직접적으로", "문제가", "이건 아닌 것 같아",
      "확실히 해야", "말해야 할 게 있어", "불만이 있어",
      "이렇게 하면 안 돼", "동의 못해",
    ],
    "diplomatic_approach": [
      "혹시", "어떻게 생각해", "이해는 하는데", "조심스럽지만",
      "말하기 좀 그렇지만", "기분 나쁘면 미안한데", "네 입장도 알겠는데",
      "한편으로는", "다만",
    ],
    "strategic_withdrawal": [
      "나중에 얘기하자", "좀 생각해볼게", "정리되면 말할게",
      "지금은 좀", "시간이 좀 필요해", "머리 좀 식히고",
    ],
    "avoidance": [
      "그냥 됐어", "몰라 그냥", "아무거나", "상관없어",
      "그 얘기는 그만", "됐어 됐어", "넘어가자",
      "굳이", "별거 아니야",
    ],
    "escalation": [
      "맨날 이래", "항상 너는", "지난번에도", "도대체",
      "이게 몇 번째야", "진짜 너무하다", "정말 어이없",
    ],
  };

  const CONFLICT_CONTEXT = [
    "싸움", "갈등", "불만", "화나", "짜증",
    "논쟁", "다툼", "의견 차이", "문제가",
    "불편", "서운", "섭섭", "안 맞",
  ];

  function R2ConflictAnalyzer_analyze(texts) {
    if (!texts || texts.length === 0) {
      return {
        default_mode: "diplomatic_approach",
        under_pressure: "diplomatic_approach",
        recovery_speed: "moderate",
        pattern_flexibility: "medium",
        narrative: "",
      };
    }

    const conflict_texts = [];
    const normal_texts = [];
    const pressure_texts = [];

    for (const text of texts) {
      const text_lower = text.toLowerCase();
      const is_conflict = CONFLICT_CONTEXT.some(c => text_lower.includes(c));
      if (is_conflict) {
        conflict_texts.push(text);
        if (["도대체", "맨날", "항상", "진짜"].some(w => text_lower.includes(w))) {
          pressure_texts.push(text);
        }
      } else {
        normal_texts.push(text);
      }
    }

    const default_mode = R2ConflictAnalyzer_classifyMode(texts);
    const under_pressure = conflict_texts.length > 0
      ? R2ConflictAnalyzer_classifyMode(conflict_texts)
      : default_mode;

    const recovery = R2ConflictAnalyzer_estimateRecovery(texts);
    const flexibility = R2ConflictAnalyzer_estimateFlexibility(texts);

    const narrative = R2ConflictAnalyzer_generateNarrative(
      default_mode, under_pressure, recovery, flexibility
    );

    return {
      default_mode: default_mode,
      under_pressure: under_pressure,
      recovery_speed: recovery,
      pattern_flexibility: flexibility,
      narrative: narrative,
    };
  }

  function R2ConflictAnalyzer_classifyMode(texts) {
    const mode_counts = {};
    for (const mode of CONFLICT_MODES) {
      mode_counts[mode] = 0;
    }

    for (const text of texts) {
      const text_lower = text.toLowerCase();
      for (const [mode, signals] of Object.entries(CONFLICT_SIGNALS)) {
        for (const signal of signals) {
          if (text_lower.includes(signal)) {
            mode_counts[mode]++;
            break;
          }
        }
      }
    }

    const modes = Object.keys(mode_counts);
    if (modes.length === 0) {
      return "diplomatic_approach";
    }

    return modes.reduce((a, b) => mode_counts[a] > mode_counts[b] ? a : b);
  }

  function R2ConflictAnalyzer_estimateRecovery(texts) {
    let in_conflict = false;
    let conflict_duration = 0;
    const recovery_durations = [];

    for (const text of texts) {
      const text_lower = text.toLowerCase();
      const is_conflict = CONFLICT_CONTEXT.some(c => text_lower.includes(c));

      if (is_conflict) {
        in_conflict = true;
        conflict_duration++;
      } else if (in_conflict) {
        recovery_durations.push(conflict_duration);
        in_conflict = false;
        conflict_duration = 0;
      }
    }

    if (recovery_durations.length === 0) {
      return "moderate";
    }

    const avg_duration = recovery_durations.reduce((a, b) => a + b, 0) / recovery_durations.length;
    if (avg_duration <= 2) {
      return "fast";
    } else if (avg_duration <= 5) {
      return "moderate";
    } else {
      return "slow";
    }
  }

  function R2ConflictAnalyzer_estimateFlexibility(texts) {
    const modes_used = new Set();

    for (const text of texts) {
      const text_lower = text.toLowerCase();
      for (const [mode, signals] of Object.entries(CONFLICT_SIGNALS)) {
        if (signals.some(signal => text_lower.includes(signal))) {
          modes_used.add(mode);
        }
      }
    }

    if (modes_used.size >= 3) {
      return "flexible";
    } else if (modes_used.size >= 2) {
      return "medium";
    } else {
      return "rigid";
    }
  }

  function R2ConflictAnalyzer_generateNarrative(default_mode, under_pressure, recovery, flexibility) {
    const mode_desc = {
      "direct_engagement": "불편한 사안을 직접적으로 꺼내어 논의하는",
      "diplomatic_approach": "상대의 감정을 고려하며 신중하게 접근하는",
      "strategic_withdrawal": "일단 정리한 후 재접근하는",
      "avoidance": "갈등 상황을 우회하거나 넘기는",
      "escalation": "감정이 확대되는 방향으로 반응하는",
    };

    let base = `평상시 ${mode_desc[default_mode] || '중립적인'} 패턴을 보입니다.`;

    if (under_pressure !== default_mode) {
      const pressure_desc = mode_desc[under_pressure] || "다른";
      base += ` 강한 압박 상황에서는 ${pressure_desc} 방향으로 변화합니다.`;
    }

    return base;
  }

  // ═══════════════════════════════════════════════════════════════
  // R3. EMOTIONAL AVAILABILITY ANALYZER
  // ═══════════════════════════════════════════════════════════════

  const EMPATHIC_SIGNALS = [
    "그랬구나", "힘들었겠다", "이해해", "맞아 그럴 수 있어",
    "당연히 그렇지", "많이 힘들었을 텐데", "어떤 기분이었어",
    "더 얘기해줘", "괜찮아", "네 마음이 어때",
  ];

  const DISMISSIVE_SIGNALS = [
    "에이 그 정도로", "좀 오버 아니야", "별거 아니야",
    "너무 예민해", "감정적이야", "쿨하게 넘겨",
    "다 그래", "원래 그런 거야",
  ];

  const SOLUTION_SIGNALS = [
    "이렇게 해봐", "해결책은", "방법이 있어",
    "~하면 돼", "내가 도와줄게", "그러지 말고",
    "차라리", "그냥 ~해",
  ];

  const SPACE_HOLDING_SIGNALS = [
    "천천히 얘기해", "급할 거 없어", "다 들을게",
    "네 속도대로", "준비되면 말해", "여기 있을게",
  ];

  const SELF_DISCLOSURE_SIGNALS = [
    "나도 그런 적", "솔직히 나는", "내 경험에는",
    "나한테도", "나도 사실", "내 얘기인데",
  ];

  function R3EmotionalAnalyzer_analyze(texts) {
    if (!texts || texts.length === 0) {
      return {
        recognition: "moderate",
        response_style: "supportive",
        solution_vs_space: "balanced",
        self_disclosure: "moderate",
        narrative: "",
      };
    }

    const total = texts.length;
    let empathic = 0;
    let dismissive = 0;
    let solution = 0;
    let space = 0;
    let disclosure = 0;

    for (const text of texts) {
      const tl = text.toLowerCase();
      if (EMPATHIC_SIGNALS.some(s => tl.includes(s))) empathic++;
      if (DISMISSIVE_SIGNALS.some(s => tl.includes(s))) dismissive++;
      if (SOLUTION_SIGNALS.some(s => tl.includes(s))) solution++;
      if (SPACE_HOLDING_SIGNALS.some(s => tl.includes(s))) space++;
      if (SELF_DISCLOSURE_SIGNALS.some(s => tl.includes(s))) disclosure++;
    }

    // Recognition speed
    const empathic_ratio = empathic / (total + EPSILON);
    let recognition = "slow";
    if (empathic_ratio > 0.2) {
      recognition = "quick";
    } else if (empathic_ratio > 0.08) {
      recognition = "moderate";
    }

    // Response style
    const style_counts = {
      "dismissive": dismissive,
      "acknowledging": Math.max(0, total - empathic - dismissive - solution - space),
      "supportive": solution + space,
      "empathic_exploration": empathic,
    };
    let response_style = Object.keys(style_counts).reduce((a, b) =>
      style_counts[a] >= style_counts[b] ? a : b
    );
    if (Object.values(style_counts).every(v => v === 0)) {
      response_style = "acknowledging";
    }

    // Solution vs Space
    const sol_total = solution + space + EPSILON;
    let sol_vs_space = "balanced";
    if (solution / sol_total > 0.7) {
      sol_vs_space = "solution_focused";
    } else if (space / sol_total > 0.7) {
      sol_vs_space = "space_holding";
    }

    // Self-disclosure
    const disc_ratio = disclosure / (total + EPSILON);
    let self_disc = "minimal";
    if (disc_ratio > 0.15) {
      self_disc = "open";
    } else if (disc_ratio > 0.05) {
      self_disc = "moderate";
    }

    const narrative = R3EmotionalAnalyzer_generateNarrative(
      recognition, response_style, sol_vs_space, self_disc
    );

    return {
      recognition: recognition,
      response_style: response_style,
      solution_vs_space: sol_vs_space,
      self_disclosure: self_disc,
      narrative: narrative,
    };
  }

  function R3EmotionalAnalyzer_generateNarrative(recog, style, svs, disc) {
    const style_desc = {
      "dismissive": "감정 표현을 최소화하는",
      "acknowledging": "감정을 인정하되 깊이 들어가지 않는",
      "supportive": "지지적으로 반응하는",
      "empathic_exploration": "공감하며 감정을 함께 탐색하는",
    };
    const svs_desc = {
      "solution_focused": "해결책 제시를 선호합니다.",
      "balanced": "해결책과 감정 공간을 균형있게 제공합니다.",
      "space_holding": "감정을 풀 수 있는 공간을 우선 만들어줍니다.",
    };
    return (
      `상대의 감정에 대해 ${style_desc[style] || '중립적으로'} 패턴을 보이며, ` +
      `${svs_desc[svs] || ''}`
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // R4. GROWTH ANALYZER
  // ═══════════════════════════════════════════════════════════════

  const ACTIVE_GROWTH_SIGNALS = [
    "배우고 싶", "도전", "성장", "발전", "개선",
    "새로운 시도", "변화", "목표", "계획",
    "노력", "공부", "연습", "더 나아",
  ];

  const REFLECTIVE_SIGNALS = [
    "돌아보면", "경험상", "교훈", "깨달",
    "알게 됐", "배웠", "실수에서", "반성",
  ];

  const STABILITY_SIGNALS = [
    "현재가 좋", "만족", "이대로", "편안",
    "굳이", "바꿀 필요", "충분", "안정",
  ];

  const EXTERNAL_SIGNALS = [
    "시키면", "해야 하니까", "어쩔 수 없", "강제",
    "의무", "분위기상", "다들 그러니까",
  ];

  function R4GrowthAnalyzer_analyze(texts) {
    if (!texts || texts.length === 0) {
      return {
        orientation: "reflective_growth",
        change_tolerance: "moderate",
        self_improvement_frequency: "periodic",
        narrative: "",
      };
    }

    const total = texts.length;
    let active = 0;
    let reflective = 0;
    let stability = 0;
    let external = 0;

    for (const text of texts) {
      const tl = text.toLowerCase();
      if (ACTIVE_GROWTH_SIGNALS.some(s => tl.includes(s))) active++;
      if (REFLECTIVE_SIGNALS.some(s => tl.includes(s))) reflective++;
      if (STABILITY_SIGNALS.some(s => tl.includes(s))) stability++;
      if (EXTERNAL_SIGNALS.some(s => tl.includes(s))) external++;
    }

    const counts = {
      "active_growth": active,
      "reflective_growth": reflective,
      "stability_oriented": stability,
      "externally_driven": external,
    };

    let orientation = Object.keys(counts).reduce((a, b) =>
      counts[a] >= counts[b] ? a : b
    );
    if (Object.values(counts).every(v => v === 0)) {
      orientation = "reflective_growth";
    }

    // Change tolerance
    const change_signals = active + reflective;
    const resist_signals = stability + external;
    const change_total = change_signals + resist_signals + EPSILON;
    const change_ratio = change_signals / change_total;

    let change_tolerance = "moderate";
    if (change_ratio > 0.65) {
      change_tolerance = "high";
    } else if (change_ratio > 0.35) {
      change_tolerance = "moderate";
    } else {
      change_tolerance = "low";
    }

    // Improvement frequency
    const improvement_ratio = (active + reflective) / (total + EPSILON);
    let frequency = "rare";
    if (improvement_ratio > 0.2) {
      frequency = "frequent";
    } else if (improvement_ratio > 0.08) {
      frequency = "periodic";
    }

    const narrative = R4GrowthAnalyzer_generateNarrative(orientation, change_tolerance);

    return {
      orientation: orientation,
      change_tolerance: change_tolerance,
      self_improvement_frequency: frequency,
      narrative: narrative,
    };
  }

  function R4GrowthAnalyzer_generateNarrative(orientation, tolerance) {
    const orient_desc = {
      "active_growth": "지속적인 자기 개선과 새로운 시도를 추구하는 패턴을 보입니다.",
      "reflective_growth": "경험에서 배우며 점진적으로 성장하는 패턴을 보입니다.",
      "stability_oriented": "현재의 안정적인 상태를 선호하는 패턴을 보입니다.",
      "externally_driven": "외부 자극이나 환경 변화에 의해 움직이는 패턴을 보입니다.",
    };
    return orient_desc[orientation] || "";
  }

  // ═══════════════════════════════════════════════════════════════
  // PIPELINE / MAIN ANALYSIS FUNCTION
  // ═══════════════════════════════════════════════════════════════

  function _now_iso() {
    return new Date().toISOString();
  }

  function _hash(data) {
    // Simple hash for demo purposes; in production, use crypto.subtle.digest or similar
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  function analyzeAnchor(messages) {
    // Input validation
    if (!messages || !Array.isArray(messages)) {
      return {
        error: "INVALID_INPUT",
        message: "Input must be an array of message objects with 'sender' and 'text' fields",
      };
    }

    // Filter for user messages
    const user_messages = messages.filter(
      m => m && (m.sender === "user" || m.sender === "me")
    );

    if (user_messages.length < MIN_TURNS_FOR_ANALYSIS) {
      return {
        error: "INSUFFICIENT_TURNS",
        message: `ANCHOR requires at least ${MIN_TURNS_FOR_ANALYSIS} user messages, got ${user_messages.length}`,
      };
    }

    const texts = user_messages.map(m => m.text || "").filter(t => t.length > 0);

    if (texts.length < MIN_TURNS_FOR_ANALYSIS) {
      return {
        error: "INSUFFICIENT_DATA",
        message: `ANCHOR requires at least ${MIN_TURNS_FOR_ANALYSIS} non-empty messages`,
      };
    }

    const input_hash = _hash(texts.join("||"));

    try {
      const attachment = R1AttachmentAnalyzer_analyze(texts);
      const conflict = R2ConflictAnalyzer_analyze(texts);
      const emotional_availability = R3EmotionalAnalyzer_analyze(texts);
      const growth = R4GrowthAnalyzer_analyze(texts);

      return {
        success: true,
        attachment: attachment,
        conflict: conflict,
        emotional_availability: emotional_availability,
        growth: growth,
        metadata: {
          engine_version: ENGINE_VERSION,
          spec_version: SPEC_VERSION,
          computed_at: _now_iso(),
          input_hash: input_hash,
          turn_count: texts.length,
        },
      };
    } catch (e) {
      return {
        error: "COMPUTATION_ERROR",
        message: e.message,
        engine_version: ENGINE_VERSION,
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // EXPORT API
  // ═══════════════════════════════════════════════════════════════

  global.ANCHOR = {
    analyze: analyzeAnchor,
    // Helper: analyze two profiles for compatibility
    matchProfiles: function(profileA, profileB) {
      if (!profileA || !profileB) {
        return { error: "Both profiles required" };
      }

      const attachmentScore = ATTACHMENT_COMPATIBILITY[
        profileA.attachment.primary_tendency + "," + profileB.attachment.primary_tendency
      ] || 0.5;

      let attachmentCompat = "low";
      let attachmentRisks = [];
      if (attachmentScore <= 0.20) {
        attachmentCompat = "low";
        attachmentRisks.push("애착 경향 조합에서 불균형 패턴이 발생할 가능성이 높습니다");
      } else if (attachmentScore <= 0.50) {
        attachmentCompat = "moderate";
      } else {
        attachmentCompat = "high";
      }

      // Conflict style compatibility
      let conflictCompat = "moderate";
      let conflictRisks = [];
      const modeA = profileA.conflict.default_mode;
      const modeB = profileB.conflict.default_mode;

      const toxic_pairs = [
        ["escalation", "escalation"],
        ["escalation", "avoidance"],
        ["avoidance", "escalation"],
      ];

      if (toxic_pairs.some(p => (p[0] === modeA && p[1] === modeB) || (p[0] === modeB && p[1] === modeA))) {
        conflictCompat = "low";
        conflictRisks.push("갈등 상황에서 상호 악순환 패턴이 발생할 수 있습니다");
      } else {
        const good_pairs = [
          ["direct_engagement", "diplomatic_approach"],
          ["diplomatic_approach", "direct_engagement"],
          ["diplomatic_approach", "diplomatic_approach"],
        ];
        if (good_pairs.some(p => (p[0] === modeA && p[1] === modeB) || (p[0] === modeB && p[1] === modeA))) {
          conflictCompat = "high";
        }
      }

      // Emotional availability compatibility
      let emotionalCompat = "high";
      let emotionalRisks = [];
      const style_rank = {
        "dismissive": 0,
        "acknowledging": 1,
        "supportive": 2,
        "empathic_exploration": 3,
      };
      const gap = Math.abs(
        (style_rank[profileA.emotional_availability.response_style] || 1) -
        (style_rank[profileB.emotional_availability.response_style] || 1)
      );
      if (gap >= 3) {
        emotionalCompat = "low";
        emotionalRisks.push("정서적 반응 수준에 큰 차이가 있어 한쪽이 불만족을 느낄 수 있습니다");
      } else if (gap >= 2) {
        emotionalCompat = "moderate";
      }

      // Growth pace compatibility
      let growthCompat = "high";
      let growthRisks = [];
      const growth_rank = {
        "externally_driven": 0,
        "stability_oriented": 1,
        "reflective_growth": 2,
        "active_growth": 3,
      };
      const growth_gap = Math.abs(
        (growth_rank[profileA.growth.orientation] || 1) -
        (growth_rank[profileB.growth.orientation] || 1)
      );
      if (growth_gap >= 3) {
        growthCompat = "low";
        growthRisks.push("성장 속도와 방향의 차이가 커 한쪽은 답답함, 한쪽은 압박을 느낄 수 있습니다");
      } else if (growth_gap >= 2) {
        growthCompat = "moderate";
      }

      // Overall score
      const scores = { "high": 3, "moderate": 2, "low": 1 };
      const weights = [MATCH_WEIGHT_ATTACHMENT, MATCH_WEIGHT_CONFLICT, MATCH_WEIGHT_EMOTIONAL, MATCH_WEIGHT_GROWTH];
      const dims = [attachmentCompat, conflictCompat, emotionalCompat, growthCompat];
      const weighted = dims.reduce((sum, compat, i) => sum + (scores[compat] || 2) * weights[i], 0);

      let overall = "moderate";
      if (weighted >= 2.5) {
        overall = "high";
      } else if (weighted < 1.5) {
        overall = "low";
      }

      const all_risks = [
        ...attachmentRisks,
        ...conflictRisks,
        ...emotionalRisks,
        ...growthRisks,
      ];

      return {
        success: true,
        overall_compatibility: overall,
        dimensions: {
          attachment: { compatibility: attachmentCompat, risks: attachmentRisks },
          conflict: { compatibility: conflictCompat, risks: conflictRisks },
          emotional: { compatibility: emotionalCompat, risks: emotionalRisks },
          growth: { compatibility: growthCompat, risks: growthRisks },
        },
        risk_summary: all_risks.length > 0 ? all_risks.join("; ") : "특별한 위험 요소가 감지되지 않았습니다.",
      };
    },
  };

})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
