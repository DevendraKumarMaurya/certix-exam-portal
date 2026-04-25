import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useNavigate, useParams, useSearchParams } from "react-router";
import toast from "react-hot-toast";
import { db } from "../../firebase/config";
import { useAuth } from "../../hooks/useAuth";

const AUTO_SAVE_DEBOUNCE_MS = 2000;
const AUTO_SAVE_INTERVAL_MS = 6000;
const MAX_TOTAL_VIOLATIONS = 5;
const WARNING_THRESHOLD_SECONDS = 300;

export default function TakeExam() {
  const { examId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState(null);
  const [attemptId, setAttemptId] = useState(searchParams.get("attempt") || "");
  const [questions, setQuestions] = useState([]);

  const [examStarted, setExamStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visited, setVisited] = useState({});
  const [flagged, setFlagged] = useState({});
  const [answers, setAnswers] = useState({});

  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);

  const [violations, setViolations] = useState({
    fullscreenExits: 0,
    tabSwitches: 0,
    blurEvents: 0,
    suspiciousActivity: 0,
  });

  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [fullscreenPromptOpen, setFullscreenPromptOpen] = useState(false);

  const startedAtRef = useRef(null);
  const submittedRef = useRef(false);
  const debounceSaveRef = useRef(null);
  const lastViolationAtRef = useRef(0);

  const localBackupKey = useMemo(
    () => (attemptId ? `exam-autosave-${attemptId}` : ""),
    [attemptId],
  );

  const fetchQuestions = useCallback(async (examData) => {
    const questionEntries = Array.isArray(examData.questions) ? examData.questions : [];

    const questionDocs = await Promise.all(
      questionEntries
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(async (examQuestion) => {
          const questionSnap = await getDoc(doc(db, "questions", examQuestion.questionId));
          if (!questionSnap.exists()) return null;

          return {
            id: questionSnap.id,
            ...questionSnap.data(),
            marks: examQuestion.marks,
            order: examQuestion.order,
          };
        }),
    );

    return questionDocs.filter(Boolean);
  }, []);

  const initializeAttempt = useCallback(async () => {
    const examSnap = await getDoc(doc(db, "exams", examId));
    if (!examSnap.exists()) {
      throw new Error("Exam not found");
    }

    const examData = { id: examSnap.id, ...examSnap.data() };

    if (!Array.isArray(examData.assignedTo) || !examData.assignedTo.includes(currentUser.uid)) {
      throw new Error("This exam is not assigned to you");
    }

    let resolvedAttemptId = searchParams.get("attempt") || "";
    let resolvedAttemptData = null;

    if (resolvedAttemptId) {
      const explicitAttemptSnap = await getDoc(doc(db, "examAttempts", resolvedAttemptId));
      if (explicitAttemptSnap.exists()) {
        resolvedAttemptData = explicitAttemptSnap.data();

        if (
          resolvedAttemptData?.status === "submitted" ||
          resolvedAttemptData?.status === "evaluated"
        ) {
          throw new Error("You have already submitted this exam. Retake is not allowed.");
        }
      }
    }

    if (!resolvedAttemptData) {
      const attemptsQuery = query(
        collection(db, "examAttempts"),
        where("examId", "==", examId),
        where("studentId", "==", currentUser.uid),
      );
      const attemptsSnap = await getDocs(attemptsQuery);

      const submittedAttempt = attemptsSnap.docs.find((attemptDoc) => {
        const status = attemptDoc.data()?.status;
        return status === "submitted" || status === "evaluated";
      });

      if (submittedAttempt) {
        throw new Error("You have already submitted this exam. Retake is not allowed.");
      }

      const ongoingAttempt = attemptsSnap.docs.find(
        (attemptDoc) => attemptDoc.data()?.status === "ongoing",
      );

      if (ongoingAttempt) {
        resolvedAttemptId = ongoingAttempt.id;
        resolvedAttemptData = ongoingAttempt.data();
      }
    }

    if (!resolvedAttemptData) {
      const newAttemptRef = await addDoc(collection(db, "examAttempts"), {
        examId,
        studentId: currentUser.uid,
        startTime: serverTimestamp(),
        endTime: null,
        answers: {},
        flaggedQuestions: [],
        status: "ongoing",
        autoSaveCount: 0,
        lastAutoSave: null,
        submittedAt: null,
        totalMarksObtained: null,
        percentage: null,
        createdAt: serverTimestamp(),
        security: {
          fullscreenExits: 0,
          tabSwitches: 0,
          blurEvents: 0,
          suspiciousActivity: 0,
        },
      });

      const newAttemptSnap = await getDoc(doc(db, "examAttempts", newAttemptRef.id));
      resolvedAttemptId = newAttemptRef.id;
      resolvedAttemptData = newAttemptSnap.data();
    }

    return { examData, resolvedAttemptId, resolvedAttemptData };
  }, [currentUser?.uid, examId, searchParams]);

  useEffect(() => {
    const load = async () => {
      if (!currentUser || !examId) return;

      try {
        setLoading(true);

        const { examData, resolvedAttemptId, resolvedAttemptData } = await initializeAttempt();
        const resolvedQuestions = await fetchQuestions(examData);

        setExam(examData);
        setAttemptId(resolvedAttemptId);
        setQuestions(resolvedQuestions);

        const preAnswers = resolvedAttemptData?.answers || {};
        const preFlagged = Array.isArray(resolvedAttemptData?.flaggedQuestions)
          ? Object.fromEntries(
              resolvedAttemptData.flaggedQuestions.map((questionId) => [questionId, true]),
            )
          : {};

        setAnswers(preAnswers);
        setFlagged(preFlagged);

        const startDate = resolvedAttemptData?.startTime?.toDate?.() || new Date();
        startedAtRef.current = startDate;

        const totalSeconds = Number(examData.duration || 0) * 60;
        const elapsedSeconds = Math.max(
          0,
          Math.floor((Date.now() - startDate.getTime()) / 1000),
        );
        setRemainingSeconds(Math.max(totalSeconds - elapsedSeconds, 0));
      } catch (error) {
        console.error("Failed to load exam:", error);
        const errorCode = error?.code ? ` (${error.code})` : "";
        const errorMessage = error?.message ? ` - ${error.message}` : "";
        toast.error(`Failed to load exam${errorCode}${errorMessage}`);
        navigate("/student/exams");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentUser, examId, fetchQuestions, initializeAttempt, navigate]);

  useEffect(() => {
    setVisited((previous) => ({ ...previous, [questions[currentIndex]?.id]: true }));
  }, [currentIndex, questions]);

  const requestFullscreenAndStart = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setExamStarted(true);
      setFullscreenPromptOpen(false);
      toast.success("Exam started in full screen mode");
    } catch (error) {
      console.error("Fullscreen request failed:", error);
      toast.error("Full screen permission is required to start this exam");
    }
  };

  const restoreFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setFullscreenPromptOpen(false);
    } catch (error) {
      console.error("Failed to restore fullscreen:", error);
      toast.error("Please allow full screen to continue the exam");
    }
  };

  const persistLocalBackup = useCallback(
    (payload) => {
      if (!localBackupKey) return;
      localStorage.setItem(localBackupKey, JSON.stringify(payload));
      setSaveState("offline");
    },
    [localBackupKey],
  );

  const saveToFirestore = useCallback(
    async (payload) => {
      if (!attemptId || submittedRef.current) return;

      if (!window.navigator.onLine) {
        persistLocalBackup(payload);
        return;
      }

      try {
        setSaveState("saving");

        await updateDoc(doc(db, "examAttempts", attemptId), {
          answers: payload.answers,
          flaggedQuestions: payload.flaggedQuestions,
          lastAutoSave: serverTimestamp(),
          autoSaveCount: increment(1),
          updatedAt: serverTimestamp(),
        });

        setLastSavedTime(new Date());
        setSaveState("saved");
        localStorage.removeItem(localBackupKey);
      } catch (error) {
        console.error("Auto-save failed:", error);
        persistLocalBackup(payload);
      }
    },
    [attemptId, localBackupKey, persistLocalBackup],
  );

  const createPayload = useCallback(() => {
    const normalizedAnswers = {};

    for (const question of questions) {
      normalizedAnswers[question.id] = {
        ...(answers[question.id] || {}),
        answer: answers[question.id]?.answer ?? "",
      };
    }

    return {
      answers: normalizedAnswers,
      flaggedQuestions: Object.keys(flagged).filter((questionId) => flagged[questionId]),
    };
  }, [answers, flagged, questions]);

  const saveNow = useCallback(async () => {
    if (!dirty) return;
    await saveToFirestore(createPayload());
    setDirty(false);
  }, [createPayload, dirty, saveToFirestore]);

  useEffect(() => {
    if (!examStarted || submittedRef.current) return;

    if (debounceSaveRef.current) {
      clearTimeout(debounceSaveRef.current);
    }

    debounceSaveRef.current = setTimeout(() => {
      saveNow();
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (debounceSaveRef.current) clearTimeout(debounceSaveRef.current);
    };
  }, [answers, flagged, examStarted, saveNow]);

  useEffect(() => {
    if (!examStarted || submittedRef.current) return;

    const interval = setInterval(() => {
      saveNow();
    }, AUTO_SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [examStarted, saveNow]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      if (!localBackupKey) return;

      try {
        const cached = localStorage.getItem(localBackupKey);
        if (!cached) return;
        const payload = JSON.parse(cached);
        await saveToFirestore(payload);
        toast.success("Offline changes synced");
      } catch (error) {
        console.error("Failed to sync backup:", error);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSaveState("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [localBackupKey, saveToFirestore]);

  const handleAutoSubmit = useCallback(
    async (reason) => {
      if (submittedRef.current || submitting) return;

      submittedRef.current = true;
      setSubmitting(true);

      try {
        await saveToFirestore(createPayload());

        await updateDoc(doc(db, "examAttempts", attemptId), {
          status: "submitted",
          submittedAt: serverTimestamp(),
          endTime: serverTimestamp(),
          security: {
            ...violations,
            autoSubmitReason: reason,
          },
        });

        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }

        toast.success(`Exam submitted: ${reason}. Results will be published soon.`);
        navigate("/student/dashboard");
      } catch (error) {
        submittedRef.current = false;
        console.error("Auto-submit failed:", error);
        toast.error("Auto-submit failed. Please submit manually.");
      } finally {
        setSubmitting(false);
      }
    },
    [attemptId, createPayload, navigate, saveToFirestore, submitting, violations],
  );

  const registerViolation = useCallback(
    (type, message) => {
      if (!examStarted || submittedRef.current) return;

      const now = Date.now();
      if (now - lastViolationAtRef.current < 800) {
        return;
      }
      lastViolationAtRef.current = now;

      setViolations((previous) => {
        const next = {
          ...previous,
          [type]: (previous[type] || 0) + 1,
        };

        const total = next.fullscreenExits + next.tabSwitches + next.blurEvents;

        if (total >= MAX_TOTAL_VIOLATIONS) {
          next.suspiciousActivity = next.suspiciousActivity + 1;
          void handleAutoSubmit("Violation limit reached");
        }

        toast.error(`${message} (${total}/${MAX_TOTAL_VIOLATIONS})`);
        return next;
      });
    },
    [examStarted, handleAutoSubmit],
  );

  useEffect(() => {
    if (!examStarted || submittedRef.current) {
      setFullscreenPromptOpen(false);
      return;
    }

    if (!document.fullscreenElement) {
      setFullscreenPromptOpen(true);
    }
  }, [examStarted]);

  useEffect(() => {
    if (!examStarted) return;

    const handleVisibility = () => {
      if (document.hidden) {
        registerViolation("tabSwitches", "Tab switch detected");
      }
    };

    const handleBlur = () => {
      registerViolation("blurEvents", "Window/app switch detected");
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !submittedRef.current) {
        setFullscreenPromptOpen(true);
        registerViolation("fullscreenExits", "Full screen exited");
      } else {
        setFullscreenPromptOpen(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [examStarted, registerViolation]);

  useEffect(() => {
    if (!examStarted || submittedRef.current) return;

    const handleContextMenu = (event) => {
      event.preventDefault();
      toast.error("Right-click is disabled during exam");
    };

    const handleClipboardAction = (event) => {
      event.preventDefault();
      toast.error("Copy/paste is disabled during exam");
    };

    const handleBackNavigation = () => {
      window.history.pushState(null, "", window.location.href);
      toast.error("Back navigation is disabled during exam");
    };

    window.history.pushState(null, "", window.location.href);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleClipboardAction);
    document.addEventListener("paste", handleClipboardAction);
    document.addEventListener("cut", handleClipboardAction);
    window.addEventListener("popstate", handleBackNavigation);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleClipboardAction);
      document.removeEventListener("paste", handleClipboardAction);
      document.removeEventListener("cut", handleClipboardAction);
      window.removeEventListener("popstate", handleBackNavigation);
    };
  }, [examStarted]);

  useEffect(() => {
    if (!examStarted || submittedRef.current) return;

    const tick = setInterval(() => {
      setRemainingSeconds((previous) => {
        const next = previous - 1;
        if (next === WARNING_THRESHOLD_SECONDS) {
          toast.error("Only 5 minutes remaining");
        }
        if (next <= 0) {
          clearInterval(tick);
          void handleAutoSubmit("Timer ended");
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [examStarted, handleAutoSubmit]);

  const handleAnswerChange = (questionId, value) => {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: {
        ...(previous[questionId] || {}),
        answer: value,
        savedAt: new Date().toISOString(),
      },
    }));
    setDirty(true);
  };

  const toggleFlag = (questionId) => {
    setFlagged((previous) => ({ ...previous, [questionId]: !previous[questionId] }));
    setDirty(true);
  };

  const handleManualSubmit = async () => {
    await handleAutoSubmit("Manual submission");
  };

  const formatTime = (seconds) => {
    const safe = Math.max(0, seconds);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const remaining = safe % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  };

  const answeredCount = questions.filter((question) => {
    const value = answers[question.id]?.answer;
    return value !== undefined && value !== null && value !== "";
  }).length;

  const flaggedCount = Object.values(flagged).filter(Boolean).length;
  const navigationQuestions = showFlaggedOnly
    ? questions.filter((item) => flagged[item.id])
    : questions;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!exam || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-lg shadow p-6 text-center max-w-md">
          <p className="text-gray-700">No questions found for this exam.</p>
          <button
            type="button"
            onClick={() => navigate("/student/exams")}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white"
          >
            Back to My Exams
          </button>
        </div>
      </div>
    );
  }

  const question = questions[currentIndex];
  const answerValue = answers[question.id]?.answer ?? "";

  const getQuestionStatusClass = (questionItem) => {
    const hasAnswer =
      answers[questionItem.id]?.answer !== undefined &&
      answers[questionItem.id]?.answer !== null &&
      answers[questionItem.id]?.answer !== "";

    if (flagged[questionItem.id]) return "bg-yellow-200 border-yellow-400";
    if (hasAnswer) return "bg-green-200 border-green-400";
    if (visited[questionItem.id]) return "bg-white border-gray-400";
    return "bg-gray-200 border-gray-300";
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-800">{exam.title}</h1>
            <p className="text-xs sm:text-sm text-gray-600">{exam.subject}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 text-sm">
            <span className={`px-3 py-1 rounded-full ${isOnline ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {isOnline ? "Online" : "Offline"}
            </span>
            <span className={`px-3 py-1 rounded-full ${saveState === "saved" ? "bg-green-100 text-green-700" : saveState === "saving" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>
              {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving..." : "Offline backup"}
            </span>
            <span className="font-semibold text-gray-800 bg-gray-100 px-3 py-1 rounded-full">
              {formatTime(remainingSeconds)}
            </span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-2 text-xs text-gray-500 flex flex-wrap gap-3">
          <span>Answered: {answeredCount}/{questions.length}</span>
          <span>Flagged: {flaggedCount}</span>
          <span>
            Last saved: {lastSavedTime ? lastSavedTime.toLocaleTimeString() : "Not yet"}
          </span>
          <span>
            Violations: {violations.fullscreenExits + violations.tabSwitches + violations.blurEvents}
          </span>
        </div>
      </header>

      {!examStarted ? (
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800">Start Secure Exam</h2>
            <p className="text-gray-600 mt-2">
              This exam requires full screen mode. Exiting full screen or switching tabs repeatedly will auto-submit your attempt.
            </p>
            <button
              type="button"
              onClick={requestFullscreenAndStart}
              className="mt-5 px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Enter Full Screen and Start
            </button>
          </div>
        </div>
      ) : (
        <main className="max-w-7xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
          <aside className="bg-white rounded-xl shadow p-4 h-fit">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">Question Navigation</h3>
              <button
                type="button"
                onClick={() => setShowFlaggedOnly((previous) => !previous)}
                className={`px-2 py-1 text-xs rounded ${showFlaggedOnly ? "bg-yellow-200 text-yellow-800" : "bg-gray-100 text-gray-700"}`}
              >
                {showFlaggedOnly ? "Show All" : "Flagged Only"}
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {navigationQuestions.map((item) => {
                const index = questions.findIndex((q) => q.id === item.id);
                return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`h-10 rounded border text-sm font-medium ${getQuestionStatusClass(item)} ${index === currentIndex ? "ring-2 ring-blue-500" : ""}`}
                >
                  {index + 1}
                </button>
                );
              })}
            </div>
            {showFlaggedOnly && navigationQuestions.length === 0 && (
              <p className="mt-2 text-xs text-gray-500">No flagged questions yet.</p>
            )}
            <div className="mt-4 text-xs text-gray-600 space-y-1">
              <p>Green: Answered</p>
              <p>Yellow: Flagged</p>
              <p>White: Visited</p>
              <p>Gray: Not visited</p>
            </div>
          </aside>

          <section className="bg-white rounded-xl shadow p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                Q{currentIndex + 1}. {question.question}
              </h2>
              <button
                type="button"
                onClick={() => toggleFlag(question.id)}
                className={`px-3 py-1 rounded-lg text-sm ${flagged[question.id] ? "bg-yellow-200 text-yellow-800" : "bg-gray-100 text-gray-700"}`}
              >
                {flagged[question.id] ? "Flagged" : "Flag for Review"}
              </button>
            </div>

            <div className="mt-5">
              {question.type === "mcq" && (
                <div className="space-y-3">
                  {(question.options || []).map((option, index) => {
                    const optionLabel = option.text ?? String(option);
                    return (
                      <label
                        key={`${question.id}-${index}`}
                        className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                      >
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          checked={answerValue === optionLabel}
                          onChange={() => handleAnswerChange(question.id, optionLabel)}
                        />
                        <span className="text-gray-700">{optionLabel}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {question.type === "descriptive" && (
                <textarea
                  value={answerValue}
                  onChange={(event) => handleAnswerChange(question.id, event.target.value)}
                  rows={8}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Write your answer here..."
                />
              )}

              {question.type === "numeric" && (
                <input
                  type="number"
                  value={answerValue}
                  onChange={(event) => handleAnswerChange(question.id, event.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter numeric answer"
                />
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3 justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(prev - 1, 0))}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => setCurrentIndex((prev) => Math.min(prev + 1, questions.length - 1))}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowSubmitDialog(true)}
                disabled={submitting}
                className="px-5 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300"
              >
                {submitting ? "Submitting..." : "Submit Exam"}
              </button>
            </div>
          </section>
        </main>
      )}

      {showSubmitDialog && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-800">Confirm Submission</h3>
            <p className="text-sm text-gray-600 mt-2">
              You answered {answeredCount} out of {questions.length} questions. Flagged questions: {flaggedCount}.
            </p>
            <p className="text-sm text-gray-600 mt-1">Are you sure you want to submit now?</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSubmitDialog(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowSubmitDialog(false);
                  await handleManualSubmit();
                }}
                className="px-4 py-2 rounded-lg bg-red-600 text-white"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {examStarted && fullscreenPromptOpen && !submittedRef.current && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900">Full Screen Required</h3>
            <p className="text-sm text-gray-700 mt-2">
              Please continue the exam in full screen mode.
            </p>
            <p className="text-sm text-red-600 mt-2 font-medium">
              You have used {violations.fullscreenExits + violations.tabSwitches + violations.blurEvents} of {MAX_TOTAL_VIOLATIONS} allowed violations.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={restoreFullscreen}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Return To Full Screen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
