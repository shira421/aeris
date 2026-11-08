plugins {
    id("com.android.application")
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}

android {
    namespace = "com.shira421.aeris"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.shira421.aeris"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"
    }

    buildFeatures {
        buildConfig = true
    }

    sourceSets.getByName("main").assets.srcDir(rootProject.file("../dist"))

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
}

