function fetchedCount(item) {
  const value = Number(item?.fetched);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function chatworkInitialResultModel({ sync, selectedRoomIds, dispatchStatus }) {
  const selected = new Set((selectedRoomIds || []).map(String));
  const allResults = ["success", "fixture"].includes(dispatchStatus) && Array.isArray(sync?.results)
    ? sync.results
    : [];
  const results = allResults.filter((item) => selected.has(String(item?.roomId)));
  const succeeded = results.filter((item) => item?.status === "success");
  const failed = results.filter((item) => item?.status !== "success");
  const totalFetched = succeeded.reduce((sum, item) => sum + fetchedCount(item), 0);
  const dispatchFailed = dispatchStatus === "failed";
  const allFailed = dispatchFailed || (results.length > 0 && failed.length === results.length);
  const partial = !allFailed && failed.length > 0;
  const zero = !allFailed && !partial && totalFetched === 0;

  return {
    results,
    totalFetched,
    hiddenResultCount: allResults.length - results.length,
    status: allFailed ? "failed" : partial ? "partial" : zero ? "empty" : "success",
  };
}
