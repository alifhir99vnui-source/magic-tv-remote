const { withMainActivity } = require('@expo/config-plugins');

function addKotlinImports(contents) {
  let updated = contents;
  const imports = [
    'import android.view.View',
    'import android.view.WindowInsets',
    'import android.view.WindowInsetsController',
  ];
  for (const line of imports) {
    if (!updated.includes(line)) {
      updated = updated.replace(/^package [^\n]+\n/m, `package ${updated.match(/^package ([^\n]+)/m)[1]}\n\n${line}`);
    }
  }
  return updated;
}

function addKotlinImmersive(contents) {
  if (contents.includes('hideSystemBars')) return contents;

  let updated = addKotlinImports(contents);
  updated = updated.replace(
    /class MainActivity : ReactActivity\(\) \{/,
    `class MainActivity : ReactActivity() {
  override fun onResume() {
    super.onResume()
    hideSystemBars()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) hideSystemBars()
  }

  @Suppress("DEPRECATION")
  private fun hideSystemBars() {
    val decorView = window.decorView
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      val controller = decorView.windowInsetsController
      if (controller != null) {
        controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
        controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      }
    } else {
      decorView.systemUiVisibility =
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
          View.SYSTEM_UI_FLAG_FULLSCREEN or
          View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
          View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
          View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
          View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
    }
  }`,
  );
  return updated;
}

function addJavaImports(contents) {
  let updated = contents;
  const imports = [
    'import android.view.View;',
    'import android.view.WindowInsets;',
    'import android.view.WindowInsetsController;',
  ];
  for (const line of imports) {
    if (!updated.includes(line)) {
      updated = updated.replace(
        /^package [^\n]+;\n/m,
        (match) => `${match}\n${line}`,
      );
    }
  }
  return updated;
}

function addJavaImmersive(contents) {
  if (contents.includes('hideSystemBars')) return contents;

  let updated = addJavaImports(contents);
  updated = updated.replace(
    /public class MainActivity extends ReactActivity \{/,
    `public class MainActivity extends ReactActivity {
  @Override
  protected void onResume() {
    super.onResume();
    hideSystemBars();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) hideSystemBars();
  }

  private void hideSystemBars() {
    View decorView = getWindow().getDecorView();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      WindowInsetsController controller = decorView.getWindowInsetsController();
      if (controller != null) {
        controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
        controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      }
    } else {
      decorView.setSystemUiVisibility(
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
          | View.SYSTEM_UI_FLAG_FULLSCREEN
          | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
          | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
          | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
          | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
      );
    }
  }`,
  );
  return updated;
}

const withFullscreen = (config) =>
  withMainActivity(config, (cfg) => {
    const contents = cfg.modResults.contents;
    cfg.modResults.contents = contents.includes('class MainActivity : ReactActivity()')
      ? addKotlinImmersive(contents)
      : addJavaImmersive(contents);
    return cfg;
  });

module.exports = withFullscreen;
